import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Flex, Text, Callout, Progress, TextField, Tabs as RadixTabs } from '@radix-ui/themes';
import { Radar, RefreshCw, XCircle, Search, ChevronRight, ChevronDown, Loader2, Clock, Download, DatabaseZap, Eye, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import DemandaDetailsModal from './DemandaDetailsModal';
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
  fetchTicketById,
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
import { stripNumericPrefix } from '../../utils/stripNumericPrefix';
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

const fmtDate = (v) => {
  if (!v) return '—';
  const s = String(v).slice(0, 10);
  if (s.length < 10) return String(v);
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

function exportRowsToExcel(rows, filename = 'radar-operacao.xlsx') {
  const HEADERS = [
    'ISSUE_KEY', 'STATUS', 'ISSUETYPE', 'SUMMARY', 'SQUAD', 'PRIORIDADE',
    'IMPEDIMENTO', 'ESTIMATIVA MACRO', 'ESTIMATIVA TOTAL',
    'DESENVOLVIMENTO', 'TESTE INTERNO', 'TESTE (QA)', 'HOMOLOGAÇÃO', 'PRODUÇÃO',
  ];

  const fmtPrio = (t) => {
    if (t.prioridadeInterna != null) {
      const meta = PRIORIDADE_INTERNA_OPTIONS.find((p) => p.value === Number(t.prioridadeInterna));
      return meta ? meta.description : String(t.prioridadeInterna);
    }
    return t.priority || '';
  };

  const data = [
    HEADERS,
    ...rows.map((t) => [
      t.issueKey || '',
      t.status || '',
      t.issueType || '',
      t.summary || '',
      stripNumericPrefix(t.grupoSuporte) || '',
      fmtPrio(t),
      t.impedimento ? 'Sim' : 'Não',
      t.estimativaMacroJira != null ? String(t.estimativaMacroJira) : '',
      t.estimativaTotal != null ? Number(t.estimativaTotal) : '',
      t.dataFimDesenvolvimento ? String(t.dataFimDesenvolvimento).slice(0, 10) : '',
      t.dataFimTesteInterno ? String(t.dataFimTesteInterno).slice(0, 10) : '',
      t.dataFimTesteQa ? String(t.dataFimTesteQa).slice(0, 10) : '',
      t.dataFimHomologacao ? String(t.dataFimHomologacao).slice(0, 10) : '',
      t.dataConclusao ? String(t.dataConclusao).slice(0, 10) : '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Larguras automáticas por coluna
  const colWidths = HEADERS.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String(data[rows.indexOf(r) + 1]?.[i] ?? '').length)
    );
    return { wch: Math.min(60, Math.max(10, maxLen + 2)) };
  });
  ws['!cols'] = colWidths;

  // Estilo do cabeçalho (bold) via cell styles — SheetJS community não suporta estilos completos;
  // a primeira linha fica no header da planilha de forma natural
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Radar Operação');

  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Status do fluxo de trabalho de DEMANDAS — fila CPFL Previsto (pré-análise) */
const DEMANDA_STATUS_FLOW_PREVISTO = [
  { status: 'Aguardando Aprovação Gestor Imediato', responsible: 'CPFL' },
  { status: 'Escrita de Requerimento',              responsible: 'CPFL' },
  { status: 'Validação Comitê',                     responsible: 'CPFL' },
  { status: 'Aguardando Solicitante',               responsible: 'CPFL' },
  { status: 'Detalhamento de Requisitos',           responsible: 'CPFL' },
  { status: 'Aguardando Profissional de TI',        responsible: 'CPFL' },
  { status: 'Aguardando Demanda/Projeto',           responsible: 'CPFL' },
  { status: 'Revisão de Requisitos de Projeto',     responsible: 'CPFL' },
];

/** Status do fluxo de trabalho de DEMANDAS — ordem e responsável pela fila */
const DEMANDA_STATUS_FLOW_ROW1 = [
  { status: 'Análise e T-Shirt',              responsible: 'NTT Data' },
  { status: 'T-Shirt Aguardando Aprovação PO', responsible: 'CPFL'    },
  { status: 'T-Shirt Concluída',               responsible: 'CPFL'    },
  { status: 'Planejamento',                    responsible: 'NTT Data' },
  { status: 'Aprovação de Planejamento',       responsible: 'CPFL'    },
  { status: 'Execução',                        responsible: 'NTT Data' },
  { status: 'Em Execução',                     responsible: 'NTT Data' },
  { status: 'Em Teste',                        responsible: 'CPFL'    },
  { status: 'Em homologação',                  responsible: 'CPFL'    },
  { status: 'Revisão de homologação',          responsible: 'NTT Data' },
  { status: 'Aguardando Mudança',              responsible: 'NTT Data' },
  { status: 'Concluída',                       responsible: 'CPFL'    },
  { status: 'Cancelada',                       responsible: 'CPFL'    },
  { status: 'Congelada',                       responsible: 'CPFL'    },
];
const DEMANDA_STATUS_FLOW_ROW2 = [];

const RESPONSIBLE_STYLE = {
  'NTT Data': { bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.4)', color: '#38bdf8' },
  CPFL:       { bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.4)',  color: '#22c55e' },
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

/** Banner exibido dentro de cada aba quando os dados ainda não foram carregados. */
function TabLoadBanner({ tabLabel, onLoad, loading }) {
  return (
    <Box className="radar-tab-load-banner">
      <Flex direction="column" align="center" gap="3">
        <DatabaseZap size={40} color="#38bdf8" strokeWidth={1.5} />
        <Box style={{ textAlign: 'center' }}>
          <Text size="4" weight="bold" style={{ display: 'block', marginBottom: 6 }}>
            Dados não carregados
          </Text>
          <Text size="2" color="gray">
            Clique no botão abaixo para buscar os dados da aba{' '}
            <Text as="span" weight="bold" style={{ color: 'var(--gray-12)' }}>
              {tabLabel}
            </Text>{' '}
            do Firestore.
          </Text>
        </Box>
        <button
          type="button"
          className="btn btn-primary radar-tab-load-btn"
          onClick={onLoad}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="radar-tab-load-spinner" />
              Carregando dados…
            </>
          ) : (
            <>
              <DatabaseZap size={16} />
              Carregar dados — {tabLabel}
            </>
          )}
        </button>
      </Flex>
    </Box>
  );
}

function useSystems() {
  const [systems, setSystems] = useState([]);
  useEffect(() => {
    getDocs(query(collection(db, 'systems'), orderBy('name', 'asc')))
      .then((snap) => setSystems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);
  return systems;
}

function useSquads() {
  const [squads, setSquads] = useState([]);
  useEffect(() => {
    getDocs(query(collection(db, 'squads'), orderBy('name', 'asc')))
      .then((snap) => setSquads(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);
  return squads;
}

function resolveSquadFromTicket(ticket, systems, squads) {
  if (!ticket.sistemasImpactados || !systems.length || !squads.length) return null;
  const sysNames = String(ticket.sistemasImpactados).split(',').map((s) => s.trim()).filter(Boolean);
  const squadIds = [...new Set(
    sysNames
      .map((name) => systems.find((s) => s.name?.trim().toLowerCase() === name.toLowerCase())?.squadId)
      .filter(Boolean)
  )];
  if (!squadIds.length) return null;
  const names = squadIds.map((id) => squads.find((sq) => sq.id === id)?.name).filter(Boolean);
  return names.length ? names.join(', ') : null;
}

function resolveGrupoSuporteFromTicket(ticket, systems) {
  if (!ticket.sistemasImpactados || !systems.length) return null;
  const sysNames = String(ticket.sistemasImpactados).split(',').map((s) => s.trim()).filter(Boolean);
  const grupos = [...new Set(
    sysNames
      .map((name) => systems.find((s) => s.name?.trim().toLowerCase() === name.toLowerCase())?.grupoSuporte)
      .filter(Boolean)
  )];
  return grupos.length ? grupos.join(', ') : null;
}

const OperacaoHome = ({ userRole }) => {
  const systems = useSystems();
  const squads = useSquads();

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
  // Tracks which escopos have been successfully loaded
  const [loadedEscopos, setLoadedEscopos] = useState(new Set());

  const [computedRadar, setComputedRadar] = useState(null);
  const [drillEscopo, setDrillEscopo] = useState(null);
  const [drillLabel, setDrillLabel] = useState('');
  const [drillIssueKeyQuery, setDrillIssueKeyQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState(() => new Set());
  const [drillTickets, setDrillTickets] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState('');
  const [drillIssueTypeFilter, setDrillIssueTypeFilter] = useState(null);
  const [drillStatusFilter, setDrillStatusFilter] = useState(null);
  const [demandaStatusFilters, setDemandaStatusFilters] = useState(() => new Set());
  const [filteringImpedidas, setFilteringImpedidas] = useState(false);
  const [demandaModalTicket, setDemandaModalTicket] = useState(null);
  const [editModalTicket, setEditModalTicket] = useState(null);
  const [modalLoadingKey, setModalLoadingKey] = useState(null);

  // Pre-compute squad per issueKey as soon as drillTickets + systems + squads are available
  const squadByIssueKey = useMemo(() => {
    const map = new Map();
    if (!drillTickets.length) return map;
    for (const ticket of drillTickets) {
      // 1. Try to resolve squad name via sistemas → squadId → squad name
      const sq = resolveSquadFromTicket(ticket, systems, squads);
      if (sq) { map.set(ticket.issueKey, sq); continue; }
      // 2. Fallback: grupoSuporte from matching system
      const gs = resolveGrupoSuporteFromTicket(ticket, systems);
      if (gs) { map.set(ticket.issueKey, gs); continue; }
      // 3. Fallback: direct ticket.grupoSuporte field
      if (ticket.grupoSuporte) map.set(ticket.issueKey, stripNumericPrefix(ticket.grupoSuporte));
    }
    return map;
  }, [drillTickets, systems, squads]);

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

  const openDrillDirect = useCallback((tickets, label) => {
    setDrillIssueKeyQuery('');
    setExpandedParents(new Set());
    setDrillEscopo('');
    setDrillLabel(label);
    setDrillIssueTypeFilter(null);
    setDrillStatusFilter(null);
    setDrillError('');
    setDrillTickets(tickets);
  }, []);

  const openDrill = useCallback(
    async (escopoKey, label, issueTypeFilter = null, statusFilter = null) => {
      setDrillIssueKeyQuery('');
      setExpandedParents(new Set());
      setDrillEscopo(escopoKey);
      setDrillLabel(label);
      setDrillIssueTypeFilter(issueTypeFilter);
      setDrillStatusFilter(statusFilter);
      setDrillTickets([]);
      setDrillError('');
      setDrillLoading(true);

      try {
        if (!Array.isArray(ticketsCache)) {
          setDrillTickets([]);
          return;
        }

        const baseTickets = escopoKey
          ? ticketsCache.filter(
              (t) => String(t.escopo || '').toUpperCase() === String(escopoKey).toUpperCase()
            )
          : ticketsCache;

        let filteredTickets = filterTickets(baseTickets, filters, squadGrupoMap || new Map());
        if (issueTypeFilter) {
          filteredTickets = filteredTickets.filter(
            (t) => (t.issueType || 'Sem tipo') === issueTypeFilter
          );
        }
        if (statusFilter) {
          filteredTickets = filteredTickets.filter(
            (t) => String(t.status || '').trim() === statusFilter
          );
        }
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

  const openDemandaModal = useCallback(async (ticket, mode) => {
    setModalLoadingKey(ticket.issueKey);
    try {
      const full = await fetchTicketById(ticket.issueKey);
      if (mode === 'edit') setEditModalTicket(full || ticket);
      else setDemandaModalTicket(full || ticket);
    } catch {
      if (mode === 'edit') setEditModalTicket(ticket);
      else setDemandaModalTicket(ticket);
    } finally {
      setModalLoadingKey(null);
    }
  }, []);

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

  // 1) Ao entrar na tela Radar, restaurar cache de sessão por escopo silenciosamente
  useEffect(() => {
    if (!statsFingerprint) return;
    const escoposToTry = ['PROBLEMAS', 'DEMANDA', 'INCIDENTE', 'SOLICITACAO', 'CATALOGO'];
    const restored = [];
    const restoredEscopos = new Set();
    for (const esc of escoposToTry) {
      try {
        const raw = sessionStorage.getItem(`operacao_radar_tickets_${statsFingerprint}_${esc}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            restored.push(...parsed);
            restoredEscopos.add(esc);
          }
        }
      } catch {
        // ignore
      }
    }
    if (restored.length > 0) {
      setTicketsCache(restored);
      setLoadedEscopos(restoredEscopos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsFingerprint]);

  /**
   * Carrega tickets do Firestore sob demanda (chamado pelo botão em cada aba).
   * @param {string|null} escopoKey - chave do escopo (ex: 'DEMANDA'). null = carregar todos via fetchTicketsGlobalForRadar.
   */
  const loadTicketsData = useCallback(async (escopoKey) => {
    if (ticketsCacheLoading) return;
    if (escopoKey && loadedEscopos.has(escopoKey)) return;

    // Bootstrap under the hood (carrega statsRadar, filterOptions, etc.)
    await ensureRadarBootstrap();

    setTicketsCacheLoading(true);
    try {
      let loaded;
      if (escopoKey) {
        loaded = await fetchTicketsForDrill({ escopoKey });
      } else {
        loaded = await fetchTicketsGlobalForRadar();
      }

      setTicketsCache((prev) => {
        const existing = Array.isArray(prev) ? prev : [];
        // Remove stale tickets for this escopo, then append fresh ones
        const filtered = escopoKey
          ? existing.filter(
              (t) => String(t.escopo || '').toUpperCase() !== String(escopoKey).toUpperCase()
            )
          : [];
        return [...filtered, ...loaded];
      });

      setLoadedEscopos((prev) => {
        const next = new Set(prev);
        if (escopoKey) {
          next.add(escopoKey);
        } else {
          // Mark all known escopos as loaded when using global fetch
          for (const t of loaded) {
            const k = String(t.escopo || '').toUpperCase();
            if (k) next.add(k);
          }
        }
        return next;
      });

      // Persist per-escopo to sessionStorage
      if (statsFingerprint) {
        try {
          if (escopoKey) {
            sessionStorage.setItem(
              `operacao_radar_tickets_${statsFingerprint}_${escopoKey}`,
              JSON.stringify(loaded)
            );
          }
        } catch {
          // ignore
        }
      }
    } finally {
      setTicketsCacheLoading(false);
    }
  }, [ticketsCacheLoading, loadedEscopos, ensureRadarBootstrap, statsFingerprint]);

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
        total: findTotal('CATALOGO'),
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

      {!bootLoading && hasData === false && statsFingerprint && (
        <Callout.Root color="amber" mb="4">
          <Callout.Text>
            Nenhum ticket em <code>tickets_global</code>. Execute a carga Jira em Configurações →
            Jira Operação (botão <strong>Iniciar Carga</strong>).
          </Callout.Text>
        </Callout.Root>
      )}

      {!bootLoading && (
        <>
          <RadixTabs.Root
            value={activeEscopoTab}
            onValueChange={(next) => {
              setActiveEscopoTab(next);
              setDrillEscopo(null);
              setDrillLabel('');
              setDrillIssueKeyQuery('');
              setDrillIssueTypeFilter(null);
              setDrillStatusFilter(null);
              setDemandaStatusFilters(new Set());
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
                ticketsCache === null ? (
                  <TabLoadBanner
                    tabLabel="Eficiência (todos os escopos)"
                    onLoad={() => loadTicketsData(null)}
                    loading={ticketsCacheLoading}
                  />
                ) : (
                  (() => {
                    const filteredTicketsAll = filterTickets(ticketsCache, filters, squadGrupoMap || new Map());
                    return <OperacaoEfficiencyChart tickets={filteredTicketsAll} />;
                  })()
                )
              ) : activeEscopoTab === 'OBSERVABILIDADE' ? (
                ticketsCache === null ? (
                  <TabLoadBanner
                    tabLabel="Observabilidade (todos os escopos)"
                    onLoad={() => loadTicketsData(null)}
                    loading={ticketsCacheLoading}
                  />
                ) : (
                  (() => {
                    const filteredTicketsAll = filterTickets(ticketsCache, filters, squadGrupoMap || new Map());
                    return (
                      <OperacaoObservabilidade
                        tickets={filteredTicketsAll}
                        onDrillTickets={openDrillDirect}
                      />
                    );
                  })()
                )
              ) : (
                (() => {
                  const escopoLoaded = loadedEscopos.has(activeEscopoTab);
                  if (!escopoLoaded) {
                    return (
                      <TabLoadBanner
                        tabLabel={visibleTabs.find((t) => t.value === activeEscopoTab)?.label || activeEscopoTab}
                        onLoad={() => loadTicketsData(activeEscopoTab)}
                        loading={ticketsCacheLoading}
                      />
                    );
                  }
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
                  // ── DEMANDA: visão enriquecida por fluxo de status ──────────────────
                  if (activeEscopoTab === 'DEMANDA') {
                    // When in "impedidas mode", visibleTickets = only impedidas within active status filters
                    const visibleTickets = (() => {
                      if (filteringImpedidas && demandaStatusFilters.size > 0) {
                        return escopoTickets.filter(
                          (t) => t.impedimento === true && demandaStatusFilters.has(String(t.status || '').trim())
                        );
                      }
                      if (demandaStatusFilters.size > 0) {
                        return escopoTickets.filter((t) => demandaStatusFilters.has(String(t.status || '').trim()));
                      }
                      return escopoTickets;
                    })();
                    const totalDemandas = visibleTickets.length;
                    const totalImpedidas = filteringImpedidas
                      ? totalDemandas
                      : visibleTickets.filter((t) => t.impedimento === true).length;
                    // When in impedidas mode, status card counts show only impedidas per status
                    const statusCounts = {};
                    const baseForCounts = filteringImpedidas
                      ? escopoTickets.filter((t) => t.impedimento === true)
                      : escopoTickets;
                    for (const t of baseForCounts) {
                      const s = t.status ? String(t.status).trim() : '';
                      if (s) statusCounts[s] = (statusCounts[s] || 0) + 1;
                    }

                    const handleToggleDemandaStatus = (status) => {
                      // Clicking a card always exits impedidas mode
                      setFilteringImpedidas(false);
                      const next = new Set(demandaStatusFilters);
                      if (next.has(status)) {
                        next.delete(status);
                      } else {
                        next.add(status);
                      }
                      setDemandaStatusFilters(next);
                      if (next.size === 0) {
                        setDrillEscopo(null);
                        setDrillTickets([]);
                        setDrillLabel('');
                        setDrillError('');
                        return;
                      }
                      const filtered = escopoTickets.filter((t) =>
                        next.has(String(t.status || '').trim())
                      );
                      const label = `Demandas · ${[...next].join(' + ')}`;
                      openDrillDirect(filtered, label);
                    };

                        const StatusCard = ({ status, responsible }) => {
                      const count = statusCounts[status] || 0;
                      const rs = RESPONSIBLE_STYLE[responsible] || RESPONSIBLE_STYLE['NTT Data'];
                      const isActive = demandaStatusFilters.has(status);
                      const hasFilter = demandaStatusFilters.size > 0;
                      // Dimmed when a filter is active but this card is not selected
                      const isDimmed = hasFilter && !isActive;
                      return (
                        <button
                          type="button"
                          onClick={() => handleToggleDemandaStatus(status)}
                          disabled={drillLoading}
                          style={{
                            background: isActive
                              ? 'rgba(56,213,169,0.08)'
                              : isDimmed
                              ? 'rgba(255,255,255,0.01)'
                              : 'rgba(255,255,255,0.02)',
                            border: isActive
                              ? '1px solid rgba(56,213,169,0.7)'
                              : isDimmed
                              ? '1px solid rgba(255,255,255,0.04)'
                              : count > 0
                              ? '1px solid rgba(56,213,169,0.3)'
                              : '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 10,
                            padding: '10px 14px',
                            width: 120,
                            flex: '0 0 120px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            boxShadow: isActive ? '0 0 0 2px rgba(56,213,169,0.18)' : 'none',
                            opacity: isDimmed ? 0.3 : 1,
                            transition: 'border 0.15s, box-shadow 0.15s, opacity 0.15s',
                          }}
                          title={`Filtrar: ${status}`}
                        >
                          <span style={{
                            fontSize: 28,
                            fontWeight: 900,
                            lineHeight: 1,
                            color: count > 0 ? '#f0f0f0' : 'rgba(255,255,255,0.25)',
                          }}>
                            {count}
                          </span>
                          <span style={{
                            fontSize: 11,
                            lineHeight: 1.3,
                            color: count > 0 ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)',
                            whiteSpace: 'normal',
                          }}>
                            {status}
                          </span>
                          <span style={{
                            marginTop: 4,
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            background: rs.bg,
                            color: rs.color,
                            border: `1px solid ${rs.border}`,
                            width: 'fit-content',
                          }}>
                            {responsible}
                          </span>
                        </button>
                      );
                    };

                    return (
                      <Box mt="1">
                        {/* ── Cabeçalho: total + impedidas ── */}
                        <Box mb="4" style={{ paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          <Text style={{ fontSize: 11, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontWeight: 700, display: 'block', marginBottom: 8 }}>
                            VISÃO GERAL
                          </Text>
                          <Flex align="center" gap="4" wrap="wrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (demandaStatusFilters.size > 0) {
                                  openDrillDirect(visibleTickets, `Demandas · ${[...demandaStatusFilters].join(' + ')}`);
                                } else {
                                  openDrill('DEMANDA', 'Demandas');
                                }
                              }}
                              disabled={drillLoading}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 1 }}
                            >
                              <span style={{ fontSize: 52, fontWeight: 900, color: '#38bdf8', lineHeight: 1 }}>
                                {formatNumber(totalDemandas)}
                              </span>
                            </button>
                            <Box>
                              <Text weight="bold" style={{ fontSize: 13, color: 'var(--gray-11)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                                DEMANDAS NO ROADMAP
                              </Text>
                              {totalImpedidas > 0 && (
                                  <button
                                  type="button"
                                  onClick={() => {
                                    const statusesWithImpedidas = new Set(
                                      escopoTickets
                                        .filter((t) => t.impedimento === true)
                                        .map((t) => String(t.status || '').trim())
                                        .filter(Boolean)
                                    );
                                    setDemandaStatusFilters(statusesWithImpedidas);
                                    setFilteringImpedidas(true);
                                    const imp = escopoTickets.filter(
                                      (t) => t.impedimento === true
                                    );
                                    openDrillDirect(imp, `Impedidas · ${[...statusesWithImpedidas].join(' + ')}`);
                                  }}
                                  disabled={drillLoading}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                >
                                  <Flex align="center" gap="1" style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.35)', borderRadius: 6, padding: '3px 10px', width: 'fit-content' }}>
                                    <Text size="1">🚧</Text>
                                    <Text size="1" weight="bold" style={{ color: '#eab308' }}>{formatNumber(totalImpedidas)} impedida(s)</Text>
                                  </Flex>
                                </button>
                              )}
                            </Box>
                            {demandaStatusFilters.size > 0 && (
                              <Flex gap="1" wrap="wrap" align="center" style={{ marginLeft: 4 }}>
                                {[...demandaStatusFilters].map((s) => (
                                  <span
                                    key={s}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      background: 'rgba(56,213,169,0.10)',
                                      border: '1px solid rgba(56,213,169,0.45)',
                                      borderRadius: 6, padding: '3px 8px',
                                      fontSize: 11, color: '#5eead4',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {s}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleDemandaStatus(s)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 13, marginLeft: 1 }}
                                      title={`Remover filtro: ${s}`}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDemandaStatusFilters(new Set());
                                    setFilteringImpedidas(false);
                                    setDrillEscopo(null);
                                    setDrillTickets([]);
                                    setDrillLabel('');
                                    setDrillError('');
                                  }}
                                  style={{
                                    background: 'none', border: '1px solid rgba(255,255,255,0.12)',
                                    borderRadius: 6, padding: '3px 8px', fontSize: 11,
                                    color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Limpar todos os filtros de status"
                                >
                                  Limpar tudo
                                </button>
                              </Flex>
                            )}
                          </Flex>
                        </Box>

                        {/* ── Status por Fluxo de Trabalho ── */}
                        <Box>
                          <Text style={{ fontSize: 11, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', fontWeight: 700, display: 'block', marginBottom: 12 }}>
                            STATUS POR FLUXO DE TRABALHO
                          </Text>
                          {/* Row 0 — fila CPFL Previsto (pré-análise) */}
                          <Text style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(34,197,94,0.6)', fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                            Fila CPFL Previsto
                          </Text>
                          <Flex gap="2" wrap="wrap" mb="4" style={{ paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {DEMANDA_STATUS_FLOW_PREVISTO.map(({ status, responsible }) => (
                              <StatusCard key={status} status={status} responsible={responsible} />
                            ))}
                          </Flex>
                          {/* Row 1 — fluxo principal */}
                          <Text style={{ fontSize: 10, letterSpacing: '0.08em', color: 'rgba(56,189,248,0.6)', fontWeight: 700, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>
                            Fluxo Principal
                          </Text>
                          <Flex gap="2" wrap="wrap" mb="3">
                            {DEMANDA_STATUS_FLOW_ROW1.map(({ status, responsible }) => (
                              <StatusCard key={status} status={status} responsible={responsible} />
                            ))}
                          </Flex>
                        </Box>
                      </Box>
                    );
                  }

                  // ── Demais escopos: resumo simples (sem gráficos) ──────────────
                  return (
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
                      {escopoTickets.length > 0 && (() => {
                        const typeCounts = {};
                        let totalImpedidos = 0;
                        for (const t of escopoTickets) {
                          const type = t.issueType || 'Sem tipo';
                          typeCounts[type] = (typeCounts[type] || 0) + 1;
                          if (t.impedimento === true) totalImpedidos += 1;
                        }
                        const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
                        return (
                          <>
                            <Flex gap="2" wrap="wrap" mt="2">
                              {sortedTypes.map(([type, count]) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => openDrill(tabCard.key, `${tabCard.label} · ${type}`, type)}
                                  disabled={drillLoading}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '3px 8px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}
                                  title={`Filtrar por ${type}`}
                                >
                                  <Text size="1" weight="bold" style={{ color: tabCard.color }}>{formatNumber(count)}</Text>
                                  <Text size="1" color="gray">{type}</Text>
                                </button>
                              ))}
                            </Flex>
                            {totalImpedidos > 0 && (
                              <Flex align="center" gap="1" mt="1" style={{ background: 'rgba(234,179,8,0.08)', borderRadius: 6, padding: '3px 10px', border: '1px solid rgba(234,179,8,0.3)', width: 'fit-content' }}>
                                <Text size="1">🚧</Text>
                                <Text size="1" weight="bold" style={{ color: '#eab308' }}>{formatNumber(totalImpedidos)}</Text>
                                <Text size="1" color="gray">impedimento(s)</Text>
                              </Flex>
                            )}
                          </>
                        );
                      })()}
                    </Box>
                  );
                })()
              )}

              {drillEscopo !== null && (
                <Box className="operacao-radar-tickets-panel">
                  <Flex className="operacao-radar-tickets-header" align="center" justify="between" wrap="wrap" gap="3">
                    <Box>
                      <Text size="4" weight="bold">
                        Tickets · {drillLabel || getEscopoRadarMeta(drillEscopo).label}
                        {drillIssueTypeFilter && (
                          <Text as="span" size="2" color="gray" ml="2">
                            [{drillIssueTypeFilter}]
                          </Text>
                        )}
                      </Text>
                      <Text size="2" color="gray">
                        {drillLoading
                          ? 'Consultando tickets no Firestore…'
                          : (() => {
                              const totalImpedimentos = drillTickets.filter((t) => t.impedimento === true).length;
                              const base = `${formatNumber(drillHierarchy.totalTickets)} ticket(s)${drillRows.length < drillHierarchy.totalTickets ? ` · ${formatNumber(drillRows.length)} exibido(s)` : ''}`;
                              return totalImpedimentos > 0
                                ? `${base} · 🚧 ${formatNumber(totalImpedimentos)} impedimento(s)`
                                : base;
                            })()}
                      </Text>
                    </Box>
                    <Flex align="end" gap="2">
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
                    <button
                      type="button"
                      className="btn btn-ghost"
                      title="Exportar para Excel (CSV)"
                      disabled={drillLoading || drillRows.length === 0}
                      onClick={() => {
                        const safeName = (drillLabel || 'radar')
                          .replace(/[^a-zA-Z0-9_\- ]/g, '')
                          .trim()
                          .replace(/\s+/g, '-')
                          .toLowerCase();
                        exportRowsToExcel(drillRows, `${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
                      }}
                      style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Download size={15} /> Exportar Excel
                    </button>
                    </Flex>
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
                        <colgroup>
                          <col className="col-num" />
                          <col className="col-acoes" />
                          <col className="col-key" />
                          <col className="col-status" />
                          <col className="col-type" />
                          <col className="col-summary" />
                          <col className="col-squad" />
                          <col className="col-prio" />
                          <col className="col-imp" />
                          <col className="col-estim" />
                          <col className="col-estim" />
                          <col className="col-date" />
                          <col className="col-date" />
                          <col className="col-date" />
                          <col className="col-date" />
                          <col className="col-date" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>AÇÕES</th>
                            <th>ISSUE_KEY</th>
                            <th>STATUS</th>
                            <th>ISSUETYPE</th>
                            <th>SUMMARY</th>
                            <th>SQUAD</th>
                            <th>PRIORIDADE</th>
                            <th>IMPEDIMENTO</th>
                            <th>EST. MACRO</th>
                            <th>EST. TOTAL</th>
                            <th>DESENVOLVIMENTO</th>
                            <th>TESTE INTERNO</th>
                            <th>TESTE (QA)</th>
                            <th>HOMOLOGAÇÃO</th>
                            <th>PRODUÇÃO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillRows.map((ticket, idx) => (
                            <tr
                              key={ticket.issueKey}
                              className={ticket.depth > 0 ? 'operacao-radar-tickets-row-child' : undefined}
                            >
                              <td className="operacao-radar-tickets-num">{idx + 1}</td>
                              <td className="operacao-radar-tickets-acoes">
                                <button
                                  type="button"
                                  className="operacao-radar-tickets-action-btn action-view"
                                  title="Ver detalhes"
                                  disabled={modalLoadingKey === ticket.issueKey}
                                  onClick={() => openDemandaModal(ticket, 'view')}
                                >
                                  {modalLoadingKey === ticket.issueKey ? <Loader2 size={14} className="spin" /> : <Eye size={14} />}
                                </button>
                                <button
                                  type="button"
                                  className="operacao-radar-tickets-action-btn action-edit"
                                  title="Editar ticket"
                                  disabled={modalLoadingKey === ticket.issueKey}
                                  onClick={() => openDemandaModal(ticket, 'edit')}
                                >
                                  <Pencil size={14} />
                                </button>
                              </td>
                              <td
                                className="operacao-radar-tickets-key-cell"
                                style={{ paddingLeft: `${0.75 + ticket.depth * 1.35}rem` }}
                              >
                                <div className="operacao-radar-tickets-key-inner">
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
                                </div>
                              </td>
                              <td>{ticket.status || '—'}</td>
                              <td>{ticket.issueType || '—'}</td>
                              <td className="operacao-radar-tickets-summary">{ticket.summary || '—'}</td>
                              <td>
                                {(() => {
                                  const sq = squadByIssueKey.get(ticket.issueKey);
                                  return sq ? (
                                    <span style={{
                                      display: 'inline-block',
                                      background: 'rgba(16,185,129,0.13)',
                                      border: '1px solid rgba(16,185,129,0.35)',
                                      borderRadius: 5,
                                      padding: '2px 8px',
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: '#6ee7b7',
                                      whiteSpace: 'nowrap',
                                    }}>{sq}</span>
                                  ) : (stripNumericPrefix(ticket.grupoSuporte) || '—');
                                })()}
                              </td>
                              <td>
                                {(() => {
                                  if (ticket.prioridadeInterna != null) {
                                    const meta = PRIORIDADE_INTERNA_OPTIONS.find((p) => p.value === Number(ticket.prioridadeInterna));
                                    return meta ? (
                                      <span style={{
                                        display: 'inline-block',
                                        background: `${meta.color}22`,
                                        border: `1px solid ${meta.color}66`,
                                        borderRadius: 5,
                                        padding: '2px 8px',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: meta.color,
                                        whiteSpace: 'nowrap',
                                      }}>{meta.description}</span>
                                    ) : String(ticket.prioridadeInterna);
                                  }
                                  return ticket.priority || '—';
                                })()}
                              </td>
                              <td style={{ textAlign: 'center', color: ticket.impedimento === true ? '#eab308' : 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                                {ticket.impedimento === true ? '🚧' : '—'}
                              </td>
                              <td style={{ textAlign: 'right', paddingRight: 8 }}>
                                {ticket.estimativaMacroJira != null && ticket.estimativaMacroJira !== '' ? String(ticket.estimativaMacroJira) : '—'}
                              </td>
                              <td style={{ textAlign: 'right', paddingRight: 8 }}>
                                {ticket.estimativaTotal != null && ticket.estimativaTotal !== '' ? Number(ticket.estimativaTotal).toLocaleString('pt-BR') : '—'}
                              </td>
                              <td>{fmtDate(ticket.dataFimDesenvolvimento)}</td>
                              <td>{fmtDate(ticket.dataFimTesteInterno)}</td>
                              <td>{fmtDate(ticket.dataFimTesteQa)}</td>
                              <td>{fmtDate(ticket.dataFimHomologacao)}</td>
                              <td>{fmtDate(ticket.dataConclusao)}</td>
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

      {/* ── Demanda Details Modal (View) ── */}
      {demandaModalTicket && (
        <DemandaDetailsModal
          ticket={demandaModalTicket}
          mode="view"
          onClose={() => setDemandaModalTicket(null)}
          onSave={handleSaveTicketField}
        />
      )}

      {/* ── Demanda Details Modal (Edit) ── */}
      {editModalTicket && (
        <DemandaDetailsModal
          ticket={editModalTicket}
          mode="edit"
          onClose={() => setEditModalTicket(null)}
          onSave={handleSaveTicketField}
        />
      )}
    </Box>
  );
};

export default OperacaoHome;
