import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Flex, Text, Select, Button, TextField, Popover, Badge, Callout, Progress } from '@radix-ui/themes';
import { Route, Filter, Layers, Save, Loader2, Trash2, ChevronRight, ChevronDown, Settings } from 'lucide-react';
import { auth } from '../firebase';
import { useOperacaoRadar } from '../contexts/OperacaoRadarContext';
import {
  fetchTicketsGlobalForRadar,
  fetchSquadsForRadar,
  buildRadarFilters,
  normalizeEscopoKey,
  ESCOPO_RADAR_ORDER,
} from '../services/operacaoRadarService';
import {
  fetchRoadmapGeralViews,
  saveRoadmapGeralView,
  deleteRoadmapGeralView,
} from '../services/roadmapGeralViewsService';
import {
  ROADMAP_GRANULARITY_OPTIONS,
  getColWidth,
  generateTimelineColumns,
  collapseGroupLabels,
  computeBarPosition,
  findMinMaxDates,
  todayColumnIndex,
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
  { value: 'createdAt', label: 'Data de Criação (CREATED_AT)' },
  { value: 'dataAprovacaoEfsr', label: 'Data de Aprovação EF/SR' },
  { value: 'dataInicioAtendimentoPlanejada', label: 'Data Início do Atendimento Planejada' },
  { value: 'dataInicioAtendimento', label: 'Data Início do Atendimento' },
  { value: 'dataAprovacaoQaPlanejada', label: 'Data Aprovação QA Planejada' },
  { value: 'dataInicioHomologacaoPlanejada', label: 'Data Início Homologação Planejada' },
  { value: 'dataInicioHomologacaoEfetiva', label: 'Data Início Homologação Efetiva' },
  { value: 'dataFimHomologacaoPlanejada', label: 'Data Fim Homologação Planejada' },
  { value: 'dataFimHomologacaoEfetiva', label: 'Data Fim Homologação Efetiva' },
  { value: 'dataEntregaProducaoPrevista', label: 'Data Entrega em Produção Prevista' },
  { value: 'resolvedAt', label: 'Data de Resolução (RESOLVED_AT)' },
  { value: 'dataPrevisao', label: 'Data de Previsão (campo interno)' },
  { value: 'updatedAt', label: 'Data de Atualização (UPDATE_AT)' },
];

const START_FIELD_OPTIONS = DATE_FIELD_OPTIONS;
const END_FIELD_OPTIONS = DATE_FIELD_OPTIONS;

function createDefaultDateConfig() {
  return { startField: 'createdAt', endField: 'resolvedAt' };
}

const STATUS_COLORS = {
  default: '#22d3ee',
};

function createEmptyFilters() {
  return {
    escopos: new Set(),
    squads: new Set(),
    grupos: new Set(),
    statuses: new Set(),
  };
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

const TICKETS_SESSION_CACHE_PREFIX = 'operacao_radar_tickets_';

const RoadmapGeral = () => {
  const { statsRadar, statsFingerprint, squads: radarSquads, ensureRadarBootstrap } = useOperacaoRadar();

  const [ticketsCache, setTicketsCache] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const [savedViews, setSavedViews] = useState([]);
  const [savedViewsLoading, setSavedViewsLoading] = useState(true);
  const [newViewName, setNewViewName] = useState('');
  const [savingView, setSavingView] = useState(false);

  const uid = auth.currentUser?.uid || null;

  // Reaproveita o cache de tickets do Radar Operação (mesma chave de sessionStorage) para evitar
  // uma segunda varredura completa de tickets_global quando o usuário já abriu o Radar antes.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError('');

      // Squads: reaproveita do contexto do Radar se já disponíveis; senão busca uma vez.
      if (Array.isArray(radarSquads) && radarSquads.length > 0) {
        setSquads(radarSquads);
      } else {
        fetchSquadsForRadar()
          .then((list) => {
            if (!cancelled) setSquads(list);
          })
          .catch(() => {});
      }

      const totalHint = Number(statsRadar?.total) || 0;
      const cacheKey = statsFingerprint ? `${TICKETS_SESSION_CACHE_PREFIX}${statsFingerprint}` : null;

      if (cacheKey) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
              setTicketsCache(parsed);
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore cache parse errors, segue para fetch normal
        }
      }

      setLoading(true);
      setLoadProgress(0);
      setLoadedCount(0);

      try {
        const tickets = await fetchTicketsGlobalForRadar({
          onProgress: (count) => {
            if (cancelled) return;
            setLoadedCount(count);
            if (totalHint > 0) {
              setLoadProgress(Math.min(99, Math.round((count / totalHint) * 100)));
            }
          },
        });
        if (cancelled) return;

        setTicketsCache(tickets);
        setLoadProgress(100);

        if (cacheKey) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(tickets));
          } catch {
            // sessionStorage pode estar cheio; ignora silenciosamente
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsFingerprint]);

  useEffect(() => {
    let cancelled = false;
    async function loadViews() {
      setSavedViewsLoading(true);
      try {
        const views = await fetchRoadmapGeralViews(uid);
        if (!cancelled) setSavedViews(views);
      } catch {
        if (!cancelled) setSavedViews([]);
      } finally {
        if (!cancelled) setSavedViewsLoading(false);
      }
    }
    if (uid) loadViews();
    else setSavedViewsLoading(false);
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const filterOptions = useMemo(() => {
    if (!Array.isArray(ticketsCache)) return { grupos: [], squads: [], statuses: [] };
    return buildRadarFilters(ticketsCache, squads);
  }, [ticketsCache, squads]);

  const squadGrupoMap = filterOptions.squadGrupoMap || new Map();

  const escopoOptions = ESCOPO_RADAR_ORDER;

  const filteredTickets = useMemo(() => {
    if (!Array.isArray(ticketsCache)) return [];
    return ticketsCache.filter((t) => {
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
  }, [ticketsCache, filters, squadGrupoMap]);

  // Datas efetivas de cada ticket: início/fim configuráveis pelo usuário (ícone de configuração).
  // Quando o campo de fim escolhido está vazio no ticket, usamos "hoje" como fallback (item em andamento).
  const ticketsWithRange = useMemo(() => {
    const now = new Date().toISOString();
    const { startField, endField } = dateConfig;
    return filteredTickets
      .filter((t) => t[startField])
      .map((t) => ({
        ...t,
        _rangeStart: t[startField],
        _rangeEnd: t[endField] || now,
      }));
  }, [filteredTickets, dateConfig]);

  const { min: minDate, max: maxDate } = useMemo(
    () => findMinMaxDates(ticketsWithRange, '_rangeStart', '_rangeEnd'),
    [ticketsWithRange]
  );

  const columns = useMemo(() => {
    if (!minDate || !maxDate) return [];
    return generateTimelineColumns(minDate, maxDate, granularity);
  }, [minDate, maxDate, granularity]);

  const superHeaderGroups = useMemo(() => collapseGroupLabels(columns), [columns]);
  const colWidth = getColWidth(granularity);
  const todayIdx = useMemo(() => todayColumnIndex(columns), [columns]);

  const groupKeyForTicket = useCallback(
    (ticket) => {
      switch (groupBy) {
        case 'escopo':
          return normalizeEscopoKey(ticket.escopo) || 'Sem escopo';
        case 'grupo':
          return ticket.grupoSuporte || 'Sem grupo';
        case 'status':
          return ticket.status || 'Sem status';
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
        default:
          return null;
      }
    },
    [groupBy, squadGrupoMap, squads]
  );

  const groupedRows = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: '__all__', label: null, tickets: ticketsWithRange }];
    }
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

  const updateFilterSet = (field, valueSet) => {
    setFilters((prev) => ({ ...prev, [field]: valueSet }));
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

  const handleSaveView = async () => {
    if (!newViewName.trim() || !uid) return;
    setSavingView(true);
    try {
      await saveRoadmapGeralView(uid, {
        name: newViewName.trim(),
        filters: {
          escopos: [...filters.escopos],
          squads: [...filters.squads],
          grupos: [...filters.grupos],
          statuses: [...filters.statuses],
        },
        groupBy,
        granularity,
        dateConfig,
      });
      const views = await fetchRoadmapGeralViews(uid);
      setSavedViews(views);
      setNewViewName('');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSavingView(false);
    }
  };

  const handleLoadView = (view) => {
    setFilters({
      escopos: new Set(view.filters?.escopos || []),
      squads: new Set(view.filters?.squads || []),
      grupos: new Set(view.filters?.grupos || []),
      statuses: new Set(view.filters?.statuses || []),
    });
    setGroupBy(view.groupBy || 'none');
    setGranularity(view.granularity || 'mes');
    setDateConfig(view.dateConfig || createDefaultDateConfig());
  };

  const handleDeleteView = async (id) => {
    try {
      await deleteRoadmapGeralView(id);
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
    } catch (e) {
      setError(e?.message || String(e));
    }
  };

  const totalWidth = columns.length * colWidth;

  if (loading) {
    const totalHint = Number(statsRadar?.total) || 0;
    return (
      <Flex align="center" justify="center" direction="column" gap="3" style={{ height: '60vh' }}>
        <Loader2 className="spinner-icon roadmap-geral-loading-spinner" size={40} />
        <Text size="3" weight="bold">
          Carregando tickets do Roadmap Geral…
        </Text>
        <Box style={{ width: 280 }}>
          <Progress value={loadProgress} />
        </Box>
        <Text size="2" color="gray">
          {totalHint > 0
            ? `${loadedCount.toLocaleString('pt-BR')} de ${totalHint.toLocaleString('pt-BR')} tickets (${loadProgress}%)`
            : `${loadedCount.toLocaleString('pt-BR')} tickets carregados…`}
        </Text>
        <Text size="1" color="gray">
          Aguarde, isso pode levar alguns segundos na primeira vez.
        </Text>
      </Flex>
    );
  }

  return (
    <Box p="5" className="roadmap-geral-page">
      <Flex align="center" justify="between" wrap="wrap" gap="3" mb="4">
        <Flex align="center" gap="3">
          <Route size={26} color="#22d3ee" />
          <Box>
            <Text as="h2" size="7" weight="bold" style={{ margin: 0 }}>
              Roadmap Geral
            </Text>
            <Text as="p" size="3" color="gray">
              Linha do tempo consolidada de todos os tickets de <code>tickets_global</code>.
            </Text>
          </Box>
        </Flex>
      </Flex>

      {error && (
        <Callout.Root color="red" mb="3">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}

      {/* Painel de controle: Filtros, Agrupamento (lado a lado), Configurar Datas, Visões */}
      <Flex className="roadmap-geral-toolbar" align="center" justify="between" wrap="wrap" gap="3" mb="4">
        <Flex align="center" gap="3" wrap="wrap">
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="surface" color="gray">
                <Filter size={16} /> Filtros
              </Button>
            </Popover.Trigger>
            <Popover.Content width="320px">
              <Flex direction="column" gap="3">
                <Text weight="bold" size="3">
                  Filtros
                </Text>

                <Box>
                  <Text as="div" size="1" weight="bold" mb="1">
                    Escopo
                  </Text>
                  <Flex direction="column" gap="1" style={{ maxHeight: 140, overflowY: 'auto' }}>
                    {escopoOptions.map((esc) => (
                      <label key={esc.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={filters.escopos.has(esc.key)}
                          onChange={() => toggleInSet('escopos', esc.key)}
                        />
                        <Text size="2">{esc.label}</Text>
                      </label>
                    ))}
                  </Flex>
                </Box>

                <Box>
                  <Text as="div" size="1" weight="bold" mb="1">
                    Squad
                  </Text>
                  <Flex direction="column" gap="1" style={{ maxHeight: 140, overflowY: 'auto' }}>
                    {(filterOptions.squads || []).map((s) => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={filters.squads.has(s.id)}
                          onChange={() => toggleInSet('squads', s.id)}
                        />
                        <Text size="2">{s.sigla ? `${s.sigla} — ${s.nome}` : s.nome}</Text>
                      </label>
                    ))}
                  </Flex>
                </Box>

                <Box>
                  <Text as="div" size="1" weight="bold" mb="1">
                    Grupo de Atendimento
                  </Text>
                  <Flex direction="column" gap="1" style={{ maxHeight: 140, overflowY: 'auto' }}>
                    {(filterOptions.grupos || []).map((g) => (
                      <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={filters.grupos.has(g.nome)}
                          onChange={() => toggleInSet('grupos', g.nome)}
                        />
                        <Text size="2">{g.nome}</Text>
                      </label>
                    ))}
                  </Flex>
                </Box>

                <Box>
                  <Text as="div" size="1" weight="bold" mb="1">
                    Status
                  </Text>
                  <Flex direction="column" gap="1" style={{ maxHeight: 140, overflowY: 'auto' }}>
                    {(filterOptions.statuses || []).map((s) => (
                      <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={filters.statuses.has(s.nome)}
                          onChange={() => toggleInSet('statuses', s.nome)}
                        />
                        <Text size="2">{s.nome}</Text>
                      </label>
                    ))}
                  </Flex>
                </Box>

                {filterActive && (
                  <Button variant="soft" color="gray" size="1" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                )}
              </Flex>
            </Popover.Content>
          </Popover.Root>

          {/* Chips com os filtros ativos, para visibilidade rápida sem abrir o popover */}
          {filters.escopos.size > 0 && (
            <Badge color="indigo" variant="soft">
              Escopo: {[...filters.escopos].join(', ')}
            </Badge>
          )}
          {filters.squads.size > 0 && (
            <Badge color="indigo" variant="soft">
              Squad: {[...filters.squads]
                .map((id) => {
                  const s = (filterOptions.squads || []).find((sq) => sq.id === id);
                  return s ? s.sigla || s.nome : id;
                })
                .join(', ')}
            </Badge>
          )}
          {filters.grupos.size > 0 && (
            <Badge color="indigo" variant="soft">
              Grupo: {[...filters.grupos].join(', ')}
            </Badge>
          )}
          {filters.statuses.size > 0 && (
            <Badge color="indigo" variant="soft">
              Status: {[...filters.statuses].join(', ')}
            </Badge>
          )}

          <Flex align="center" gap="2">
            <Layers size={16} color="var(--text-muted)" />
            <Text size="1" color="gray" style={{ letterSpacing: '0.05em' }}>
              AGRUPAR POR
            </Text>
            <Select.Root value={groupBy} onValueChange={setGroupBy}>
              <Select.Trigger style={{ minWidth: 170 }} />
              <Select.Content>
                {GROUP_BY_OPTIONS.map((opt) => (
                  <Select.Item key={opt.value} value={opt.value}>
                    {opt.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
        </Flex>

        <Flex align="center" gap="2">
          <Popover.Root>
            <Popover.Trigger>
              <Button variant="soft" color="gray" title="Configurar datas consideradas na timeline">
                <Settings size={16} />
              </Button>
            </Popover.Trigger>
            <Popover.Content width="300px">
              <Flex direction="column" gap="3">
                <Text weight="bold" size="3">
                  Configurar Datas da Timeline
                </Text>
                <Text size="1" color="gray">
                  Escolha quais campos de data do ticket definem o início e o fim de cada barra.
                </Text>

                <label>
                  <Text as="div" size="1" weight="bold" mb="1">
                    Data de Início
                  </Text>
                  <Select.Root
                    value={dateConfig.startField}
                    onValueChange={(v) => setDateConfig((prev) => ({ ...prev, startField: v }))}
                  >
                    <Select.Trigger style={{ width: '100%' }} />
                    <Select.Content>
                      {START_FIELD_OPTIONS.map((opt) => (
                        <Select.Item key={opt.value} value={opt.value}>
                          {opt.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </label>

                <label>
                  <Text as="div" size="1" weight="bold" mb="1">
                    Data de Fim
                  </Text>
                  <Select.Root
                    value={dateConfig.endField}
                    onValueChange={(v) => setDateConfig((prev) => ({ ...prev, endField: v }))}
                  >
                    <Select.Trigger style={{ width: '100%' }} />
                    <Select.Content>
                      {END_FIELD_OPTIONS.map((opt) => (
                        <Select.Item key={opt.value} value={opt.value}>
                          {opt.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Root>
                </label>

                <Text size="1" color="gray">
                  Quando o campo de fim escolhido estiver vazio no ticket (ex: ainda não resolvido), a barra é
                  exibida até a data de hoje.
                </Text>
              </Flex>
            </Popover.Content>
          </Popover.Root>

          <Popover.Root>
            <Popover.Trigger>
              <Button variant="outline">
                <Save size={16} /> Visões Salvas ({savedViews.length})
              </Button>
            </Popover.Trigger>
          <Popover.Content width="300px">
            <Text weight="bold" mb="2" as="div">
              Salvar visão atual
            </Text>
            <Flex gap="2" mb="4">
              <TextField.Root
                placeholder="Nome da visão..."
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                style={{ flex: 1 }}
              />
              <Button size="1" onClick={handleSaveView} disabled={!newViewName.trim() || savingView || !uid}>
                {savingView ? <Loader2 size={14} className="spinner-icon" /> : 'Salvar'}
              </Button>
            </Flex>

            <Text weight="bold" mb="2" as="div">
              Carregar visão
            </Text>
            <Flex direction="column" gap="2">
              {savedViewsLoading ? (
                <Loader2 size={16} className="spinner-icon" />
              ) : savedViews.length === 0 ? (
                <Text size="1" color="gray">
                  Nenhuma visão salva.
                </Text>
              ) : (
                savedViews.map((view) => (
                  <Flex
                    key={view.id}
                    justify="between"
                    align="center"
                    style={{ background: 'var(--gray-3)', padding: 8, borderRadius: 6 }}
                  >
                    <Text size="2" style={{ cursor: 'pointer', flex: 1 }} onClick={() => handleLoadView(view)}>
                      {view.name}
                    </Text>
                    <Trash2
                      size={14}
                      style={{ cursor: 'pointer', color: 'var(--red-9)' }}
                      onClick={() => handleDeleteView(view.id)}
                    />
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
        <Text color="gray">Nenhum ticket com data de criação encontrado para os filtros selecionados.</Text>
      ) : (
        <Box className="roadmap-geral-timeline-wrap">
          <Box className="roadmap-geral-timeline" style={{ width: totalWidth + 240 }}>
            {/* Cabeçalho: super-header (mês/ano) + colunas */}
            <Box className="roadmap-geral-header-row">
              <Box className="roadmap-geral-row-label-cell roadmap-geral-header-corner" />
              <Flex>
                {superHeaderGroups.map((g, idx) => (
                  <Box
                    key={`${g.label}-${idx}`}
                    className="roadmap-geral-super-header"
                    style={{ width: g.span * colWidth }}
                  >
                    <Text size="1" color="gray">
                      {g.label}
                    </Text>
                  </Box>
                ))}
              </Flex>
            </Box>

            <Box className="roadmap-geral-header-row roadmap-geral-header-row-cols">
              <Box className="roadmap-geral-row-label-cell roadmap-geral-header-corner" />
              <Flex>
                {columns.map((col, idx) => (
                  <Box
                    key={col.key}
                    className={`roadmap-geral-col-header${idx === todayIdx ? ' is-today' : ''}`}
                    style={{ width: colWidth }}
                  >
                    <Text size="1">{col.label}</Text>
                  </Box>
                ))}
              </Flex>
            </Box>

            {/* Corpo: grupos + barras */}
            {groupedRows.map((group) => {
              const isCollapsed = collapsedGroups.has(group.key);
              return (
                <Box key={group.key}>
                  {group.label !== null && (
                    <Flex
                      align="center"
                      gap="2"
                      className="roadmap-geral-group-header"
                      onClick={() => toggleGroupCollapse(group.key)}
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <Text size="2" weight="bold">
                        {group.label}
                      </Text>
                      <Badge color="gray" variant="soft">
                        {group.tickets.length}
                      </Badge>
                    </Flex>
                  )}

                  {!isCollapsed &&
                    group.tickets.map((ticket) => {
                      const pos = computeBarPosition(columns, ticket._rangeStart, ticket._rangeEnd);
                      return (
                        <Flex key={ticket.issueKey} align="center" className="roadmap-geral-row">
                          <Box className="roadmap-geral-row-label-cell">
                            <Text size="1" className="roadmap-geral-row-label-text" title={ticket.summary}>
                              {ticket.issueKey} · {ticket.summary || 'Sem título'}
                            </Text>
                          </Box>
                          <Box className="roadmap-geral-row-track" style={{ width: totalWidth }}>
                            {pos && (
                              <Box
                                className="roadmap-geral-bar"
                                title={`${ticket.issueKey} — ${ticket.status || ''}`}
                                style={{
                                  marginLeft: pos.offset * colWidth,
                                  width: Math.max(pos.span * colWidth - 4, 6),
                                  background: barColorForTicket(ticket),
                                }}
                              />
                            )}
                          </Box>
                        </Flex>
                      );
                    })}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Rodapé: seletor de granularidade da linha do tempo */}
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
