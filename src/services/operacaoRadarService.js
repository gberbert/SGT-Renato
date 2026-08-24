import {
  collection,
  doc,
  documentId,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ESCOPO_SEED } from '../utils/jqlCargaClient';
import { getFunctions, httpsCallable } from 'firebase/functions';

const TICKETS_GLOBAL = 'tickets_global';
const GRUPO_ATENDIMENTO = 'grupo_atendimento';
const STATS_DOC = doc(db, 'operacao_stats', 'summary');
const PAGE_SIZE = 500;
const DRILL_LIMIT = 2000;

export const ESCOPO_RADAR_ORDER = [
  { key: 'PROBLEMAS', label: 'PROBLEMAS', color: '#f87171' },
  { key: 'DEMANDA FAST', label: 'DEMANDA FAST', color: '#fb923c' },
  { key: 'DEMANDA', label: 'DEMANDA', color: '#facc15' },
  { key: 'INCIDENTE', label: 'INCIDENTE', color: '#4ade80' },
  { key: 'SOLICITACAO', label: 'SOLICITAÇÃO', color: '#22d3ee' },
  { key: 'CATALOGO', label: 'CATÁLOGO', color: '#a78bfa' },
];

export function normalizeEscopoKey(raw) {
  const value = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!value) return '';
  if (value.startsWith('SOLICIT')) return 'SOLICITACAO';
  if (value.startsWith('CATAL')) return 'CATALOGO';
  return value;
}

export function getEscopoRadarMeta(key) {
  return ESCOPO_RADAR_ORDER.find((e) => e.key === key) || { key, label: key, color: '#22d3ee' };
}

export function computeAgingDays(createdAt) {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const now = new Date();
  const startUtc = Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate());
  const endUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((endUtc - startUtc) / 86400000));
}

export function resolveLinkedWorkItems(ticket) {
  const stored = ticket.linkedWorkItems || ticket.linkedTicketKeys || [];
  return [...new Set(stored.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
}

export function formatLinkedWorkItemsLabel(ticket) {
  const keys = resolveLinkedWorkItems(ticket);
  return keys.length ? keys.join(', ') : '—';
}

function ticketGrupoNames(ticket) {
  return [ticket.grupoSuporte, ticket.grupoSolucionador].filter(Boolean);
}

export function buildSquadGrupoMap(squads, grupoNames) {
  const map = new Map();
  for (const squad of squads) {
    const sigla = String(squad.sigla || '').trim().toUpperCase();
    const nome = String(squad.name || squad.nome || '').trim().toUpperCase();
    const tokens = [sigla, ...nome.split(/\s+/).filter((t) => t.length >= 3)];
    const matches = grupoNames.filter((grupo) => {
      const g = grupo.toUpperCase();
      return tokens.some((token) => token && g.includes(token));
    });
    map.set(squad.id, matches);
  }
  return map;
}

export function buildRadarFilters(tickets, squads) {
  const grupoSet = new Map();
  const statusSet = new Map();

  for (const ticket of tickets) {
    for (const g of ticketGrupoNames(ticket)) {
      if (!grupoSet.has(g)) grupoSet.set(g, 0);
      grupoSet.set(g, grupoSet.get(g) + 1);
    }
    if (ticket.status) {
      if (!statusSet.has(ticket.status)) statusSet.set(ticket.status, 0);
      statusSet.set(ticket.status, statusSet.get(ticket.status) + 1);
    }
  }

  const grupos = [...grupoSet.entries()]
    .map(([nome, total]) => ({ id: nome, nome, total }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const statuses = [...statusSet.entries()]
    .map(([nome, total]) => ({ id: nome, nome, total }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

  const squadOptions = (squads || []).map((s) => ({
    id: s.id,
    nome: s.name || s.nome || s.sigla || s.id,
    sigla: s.sigla || '',
    total: 0,
  }));

  const squadGrupoMap = buildSquadGrupoMap(squads, grupos.map((g) => g.nome));
  for (const squad of squadOptions) {
    const linked = squadGrupoMap.get(squad.id) || [];
    squad.total = tickets.filter((t) =>
      ticketGrupoNames(t).some((g) => linked.includes(g))
    ).length;
  }

  return { grupos, squads: squadOptions, statuses, squadGrupoMap };
}

export function createRadarFilterState() {
  return {
    grupos: new Set(),
    squads: new Set(),
    statuses: new Set(),
    createdAt: { start: '', end: '' },
    resolvedAt: { start: '', end: '' },
  };
}

function matchesDateRange(value, range) {
  if (!range?.start && !range?.end) return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;

  if (range.start) {
    const startTime = new Date(`${range.start}T00:00:00`).getTime();
    if (!Number.isNaN(startTime) && time < startTime) return false;
  }
  if (range.end) {
    const endTime = new Date(`${range.end}T23:59:59.999`).getTime();
    if (!Number.isNaN(endTime) && time > endTime) return false;
  }
  return true;
}

function matchesGrupoFilter(ticket, selectedGrupos) {
  if (!selectedGrupos?.size) return true;
  const names = ticketGrupoNames(ticket);
  return names.some((n) => selectedGrupos.has(n));
}

function matchesSquadFilter(ticket, selectedSquads, squadGrupoMap) {
  if (!selectedSquads?.size) return true;
  const allowed = new Set();
  for (const squadId of selectedSquads) {
    for (const g of squadGrupoMap.get(squadId) || []) allowed.add(g);
  }
  if (!allowed.size) return false;
  return ticketGrupoNames(ticket).some((g) => allowed.has(g));
}

function matchesStatusFilter(ticket, selectedStatuses) {
  if (!selectedStatuses?.size) return true;
  return selectedStatuses.has(ticket.status);
}

export function filterTickets(tickets, filters, squadGrupoMap) {
  return tickets.filter(
    (t) =>
      matchesGrupoFilter(t, filters.grupos) &&
      matchesSquadFilter(t, filters.squads, squadGrupoMap) &&
      matchesStatusFilter(t, filters.statuses) &&
      matchesDateRange(t.createdAt, filters.createdAt) &&
      matchesDateRange(t.resolvedAt, filters.resolvedAt)
  );
}

export function computeRadarEscopos(tickets) {
  const counts = {};
  const issueTypesByEscopo = {};
  for (const item of ESCOPO_RADAR_ORDER) {
    counts[item.key] = 0;
    issueTypesByEscopo[item.key] = new Map();
  }

  for (const ticket of tickets) {
    const key = normalizeEscopoKey(ticket.escopo);
    if (!key) continue;
    if (counts[key] == null) {
      counts[key] = 0;
      issueTypesByEscopo[key] = new Map();
    }
    counts[key] += 1;

    const issueType = String(ticket.issueType || 'Sem tipo').trim() || 'Sem tipo';
    const typeMap = issueTypesByEscopo[key];
    typeMap.set(issueType, (typeMap.get(issueType) || 0) + 1);
  }

  const escopos = ESCOPO_RADAR_ORDER.filter((item) => counts[item.key] > 0).map((item) => {
    const issueTypes = [...(issueTypesByEscopo[item.key] || new Map()).entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));

    return {
      key: item.key,
      label: item.label,
      color: item.color,
      total: counts[item.key],
      issueTypes,
    };
  });

  return {
    total: tickets.length,
    escopos,
  };
}

export function escopoStatsStorageKey(raw) {
  const key = normalizeEscopoKey(raw);
  return key ? key.replace(/\s+/g, '_') : '';
}

export function flattenByEscopoStats(raw) {
  const counts = {};

  const visit = (node, parts) => {
    if (node == null) return;

    if (typeof node === 'number') {
      const key = normalizeEscopoKey(parts.join(' '));
      if (key) counts[key] = (counts[key] || 0) + node;
      return;
    }

    if (typeof node !== 'object' || Array.isArray(node)) return;

    for (const [part, value] of Object.entries(node)) {
      const label = String(part).replace(/_/g, ' ');
      const numeric = Number(value);
      if (Number.isFinite(numeric) && typeof value !== 'object') {
        const key = normalizeEscopoKey([...parts, label].filter(Boolean).join(' '));
        if (key) counts[key] = (counts[key] || 0) + numeric;
      } else if (value && typeof value === 'object') {
        visit(value, [...parts, label]);
      }
    }
  };

  visit(raw, []);
  return counts;
}

export function parseEscopoCountsFromStats(stats) {
  if (!stats) return {};

  const counts = { ...flattenByEscopoStats(stats.byEscopo || {}) };

  for (const [field, value] of Object.entries(stats)) {
    if (!field.startsWith('byEscopo.')) continue;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) continue;
    const key = normalizeEscopoKey(field.slice('byEscopo.'.length).replace(/_/g, ' '));
    if (key) counts[key] = (counts[key] || 0) + numeric;
  }

  return counts;
}

export function normalizeIssueTypeCounts(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => ({
        name: String(item?.name || item?.issueType || 'Sem tipo').trim() || 'Sem tipo',
        total: Number(item?.total) || 0,
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
  }

  if (!raw || typeof raw !== 'object') return [];

  return Object.entries(raw)
    .map(([name, total]) => ({
      name: String(name).trim() || 'Sem tipo',
      total: Number(total) || 0,
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
}

export function parseIssueTypesByEscopoFromStats(stats) {
  const result = {};
  const raw = stats?.byIssueTypeByEscopo;
  if (!raw || typeof raw !== 'object') return result;

  for (const [escopoRaw, types] of Object.entries(raw)) {
    const key = normalizeEscopoKey(String(escopoRaw).replace(/_/g, ' '));
    if (!key) continue;
    result[key] = normalizeIssueTypeCounts(types);
  }

  return result;
}

export function attachIssueTypesToEscopos(escopos = [], issueTypesByEscopo = {}) {
  return escopos.map((item) => {
    const fromItem = normalizeIssueTypeCounts(item.issueTypes);
    const fromStats = issueTypesByEscopo[item.key] || [];
    return {
      ...item,
      issueTypes: fromItem.length ? fromItem : fromStats,
    };
  });
}

export function buildRadarEscoposFromCounts(countsByKey = {}, issueTypesByEscopo = {}) {
  return ESCOPO_RADAR_ORDER.filter((item) => Number(countsByKey[item.key]) > 0).map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    total: Number(countsByKey[item.key]),
    issueTypes: issueTypesByEscopo[item.key] || [],
  }));
}

export function buildRadarByEscopoFromStorageMap(byEscopo = {}, byIssueTypeByEscopo = {}) {
  const counts = flattenByEscopoStats(byEscopo);
  const issueTypesByEscopo = parseIssueTypesByEscopoFromStats({ byIssueTypeByEscopo });
  return buildRadarEscoposFromCounts(counts, issueTypesByEscopo);
}

export function buildRadarFromStats(stats) {
  if (!stats) return null;

  const issueTypesByEscopo = parseIssueTypesByEscopoFromStats(stats);

  if (Array.isArray(stats.radarByEscopo) && stats.radarByEscopo.length) {
    const escopos = attachIssueTypesToEscopos(
      stats.radarByEscopo
        .map((item) => {
          const meta = getEscopoRadarMeta(item.key || item.label);
          return {
            key: meta.key,
            label: item.label || meta.label,
            color: item.color || meta.color,
            total: Number(item.total) || 0,
            issueTypes: item.issueTypes,
          };
        })
        .filter((item) => item.total > 0),
      issueTypesByEscopo
    );

    const total =
      Number(stats.totalTicketsExact) ||
      Number(stats.totalTickets) ||
      escopos.reduce((acc, item) => acc + item.total, 0) ||
      0;

    if (!total && !escopos.length) return null;
    return { total, escopos };
  }

  const counts = parseEscopoCountsFromStats(stats);
  const escopos = buildRadarEscoposFromCounts(counts, issueTypesByEscopo);

  const summedEscopos = escopos.reduce((acc, item) => acc + item.total, 0);
  const total =
    Number(stats.totalTicketsExact) ||
    Number(stats.totalTickets) ||
    summedEscopos ||
    0;

  if (!total && !escopos.length) return null;

  return { total, escopos };
}

/** Fallback barato: 6 count queries indexadas (~dezenas de reads), sem varrer tickets_global. */
export async function fetchEscopoCountsFromFirestore() {
  const entries = await Promise.all(
    ESCOPO_RADAR_ORDER.map(async ({ key }) => {
      const snap = await getCountFromServer(
        query(collection(db, TICKETS_GLOBAL), where('escopo', '==', key))
      );
      return [key, snap.data().count];
    })
  );

  return Object.fromEntries(entries);
}

export async function buildRadarFromStatsWithFallback(stats) {
  let statsRadar = buildRadarFromStats(stats);
  const issueTypesByEscopo = parseIssueTypesByEscopoFromStats(stats);
  const totalHint =
    Number(stats?.totalTicketsExact) ||
    Number(stats?.totalTickets) ||
    statsRadar?.total ||
    0;

  if (totalHint > 0 && !statsRadar?.escopos?.length) {
    const counts = await fetchEscopoCountsFromFirestore();
    const escopos = buildRadarEscoposFromCounts(counts, issueTypesByEscopo);
    const summed = escopos.reduce((acc, item) => acc + item.total, 0);
    statsRadar = {
      total: totalHint || summed,
      escopos,
    };
  } else if (statsRadar?.escopos?.length) {
    statsRadar = {
      ...statsRadar,
      escopos: attachIssueTypesToEscopos(statsRadar.escopos, issueTypesByEscopo),
    };
  }

  return statsRadar;
}

function buildStatusOptionsFromStats(stats) {
  const byStatus = stats?.byStatus || {};
  return Object.entries(byStatus)
    .map(([nome, total]) => ({ id: nome, nome, total: Number(total) || 0 }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
}

async function fetchGrupoOptionsForRadar() {
  const snap = await getDocs(collection(db, GRUPO_ATENDIMENTO));
  return snap.docs
    .map((d) => {
      const nome = d.data().nome || d.id;
      return { id: nome, nome, total: 0 };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function fetchRadarBootstrap() {
  // Primeiro: tentar buscar bootstrap via backend (evita varrer tickets_global no browser)
  try {
    const functions = getFunctions();
    const callable = httpsCallable(functions, 'getOperacaoRadarBootstrap');
    const resp = await callable({});
    const payload = resp?.data || resp;

    // reconstrói Map para compatibilidade com o front
    const squadGrupoMapSerializable = payload?.squadGrupoMap || {};
    const squadGrupoMap = new Map(Object.entries(squadGrupoMapSerializable));

    return {
      stats: payload?.stats || null,
      statsRadar: payload?.statsRadar || null,
      squads: Array.isArray(payload?.squads) ? payload.squads : [],
      filterOptions: payload?.filterOptions || { grupos: [], squads: [], statuses: [] },
      squadGrupoMap,
    };
  } catch (e) {
    // Fallback: mantém o comportamento antigo (caso a callable falhe)
    const [statsSnap, squads, grupos] = await Promise.all([
      getDoc(STATS_DOC),
      fetchSquadsForRadar(),
      fetchGrupoOptionsForRadar(),
    ]);

    const stats = statsSnap.exists() ? statsSnap.data() : null;
    const statsRadar = await buildRadarFromStatsWithFallback(stats);

    let statuses = buildStatusOptionsFromStats(stats);

    if (!Array.isArray(statuses) || statuses.length === 0) {
      const tickets = await fetchTicketsGlobalForRadar();
      const statusSet = new Map();
      for (const t of tickets) {
        const s = t.status ? String(t.status).trim() : '';
        if (!s) continue;
        statusSet.set(s, (statusSet.get(s) || 0) + 1);
      }

      statuses = [...statusSet.entries()]
        .map(([nome, total]) => ({ id: nome, nome, total }))
        .filter((item) => item.total > 0)
        .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    const squadOptions = squads.map((s) => ({
      id: s.id,
      nome: s.name || s.nome || s.sigla || s.id,
      sigla: s.sigla || '',
      total: 0,
    }));

    return {
      stats,
      statsRadar,
      squads,
      filterOptions: {
        grupos,
        squads: squadOptions,
        statuses,
      },
      squadGrupoMap: buildSquadGrupoMap(squads, grupos.map((g) => g.nome)),
    };
  }
}

export function mapDrillTicket(t) {
  return {
    issueKey: t.issueKey,
    issueUrl: t.issueUrl,
    summary: t.summary,
    status: t.status,
    priority: t.priority,
    issueType: t.issueType,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    grupoSuporte: t.grupoSuporte,
    parentKey: t.parentKey || null,
    epicKey: t.epicKey || null,
    linkedWorkItems: Array.isArray(t.linkedWorkItems)
      ? t.linkedWorkItems
      : Array.isArray(t.linkedTicketKeys)
        ? t.linkedTicketKeys
        : [],
    linkedTicketKeys: Array.isArray(t.linkedTicketKeys)
      ? t.linkedTicketKeys
      : Array.isArray(t.linkedWorkItems)
        ? t.linkedWorkItems
        : [],
    agingDays: t.agingDays ?? computeAgingDays(t.createdAt),
    escopo: normalizeEscopoKey(t.escopo),
  };
}

function sortTicketsByUpdatedAt(a, b) {
  return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
}

export function buildDrillTicketHierarchy(tickets) {
  const mapped = tickets.map(mapDrillTicket);
  const byKey = new Map(mapped.map((ticket) => [ticket.issueKey, ticket]));
  const childrenByParent = new Map();
  const roots = [];

  for (const ticket of mapped) {
    const parentKey = ticket.parentKey;
    if (parentKey && parentKey !== ticket.issueKey && byKey.has(parentKey)) {
      if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
      childrenByParent.get(parentKey).push(ticket);
    } else {
      roots.push(ticket);
    }
  }

  roots.sort(sortTicketsByUpdatedAt);
  for (const children of childrenByParent.values()) {
    children.sort(sortTicketsByUpdatedAt);
  }

  return { roots, childrenByParent, totalTickets: mapped.length };
}

export function flattenDrillHierarchy(hierarchy, expandedKeys, limit = DRILL_LIMIT) {
  const { roots, childrenByParent } = hierarchy;
  const expanded = expandedKeys instanceof Set ? expandedKeys : new Set(expandedKeys || []);
  const rows = [];
  let count = 0;

  const visit = (ticket, depth) => {
    if (count >= limit) return;
    const children = childrenByParent.get(ticket.issueKey) || [];
    rows.push({
      ...ticket,
      depth,
      hasChildren: children.length > 0,
      childCount: children.length,
      isExpanded: expanded.has(ticket.issueKey),
      agingDays: computeAgingDays(ticket.createdAt) ?? ticket.agingDays,
      linkedTicketsLabel: formatLinkedWorkItemsLabel(ticket),
      linkedWorkItems: resolveLinkedWorkItems(ticket),
    });
    count += 1;
    if (expanded.has(ticket.issueKey)) {
      for (const child of children) {
        visit(child, depth + 1);
        if (count >= limit) break;
      }
    }
  };

  for (const root of roots) {
    visit(root, 0);
    if (count >= limit) break;
  }

  return rows;
}

export function prepareDrillHierarchy(tickets, escopoKey, issueKeyQuery) {
  let list = tickets;
  if (escopoKey) {
    list = list.filter((t) => normalizeEscopoKey(t.escopo) === escopoKey);
  }
  list = filterDrillTicketsByIssueKey(list, issueKeyQuery);
  return buildDrillTicketHierarchy(list);
}

export function getDrillTickets(tickets, escopoKey) {
  let list = tickets;
  if (escopoKey) {
    list = tickets.filter((t) => normalizeEscopoKey(t.escopo) === escopoKey);
  }
  return list
    .sort(sortTicketsByUpdatedAt)
    .slice(0, DRILL_LIMIT)
    .map(mapDrillTicket);
}

export function filterDrillTicketsByIssueKey(tickets, query) {
  const q = String(query || '').trim().toUpperCase();
  if (!q) return tickets;
  return tickets.filter((t) => String(t.issueKey || '').toUpperCase().includes(q));
}

function mapFirestoreTicketDoc(d) {
  const data = d.data();
  return {
    issueKey: data.issueKey || d.id,
    issueUrl: data.issueUrl,
    summary: data.summary,
    status: data.status,
    priority: data.priority,
    issueType: data.issueType,
    parentKey: data.parentKey || null,
    epicKey: data.epicKey || null,
    linkedWorkItems: Array.isArray(data.linkedWorkItems)
      ? data.linkedWorkItems
      : Array.isArray(data.linkedTicketKeys)
        ? data.linkedTicketKeys
        : [],
    linkedTicketKeys: Array.isArray(data.linkedTicketKeys)
      ? data.linkedTicketKeys
      : Array.isArray(data.linkedWorkItems)
        ? data.linkedWorkItems
        : [],
    agingDays: data.agingDays ?? computeAgingDays(data.createdAt),
    escopo: data.escopo,
    grupoSuporte: data.grupoSuporte,
    grupoSolucionador: data.grupoSolucionador,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    resolvedAt: data.resolvedAt || null,
    reopenCount: Number(data.reopenCount) || 0,
    status: data.status,
  };
}

/** Lê tickets do Firestore por escopo (drill-down), sem varrer tickets_global inteiro. */
export async function fetchTicketsForDrill({ escopoKey } = {}) {
  if (escopoKey) {
    const snap = await getDocs(
      query(collection(db, TICKETS_GLOBAL), where('escopo', '==', escopoKey), limit(5000))
    );
    return snap.docs.map(mapFirestoreTicketDoc);
  }

  const perEscopoLimit = Math.max(500, Math.ceil(DRILL_LIMIT / ESCOPO_RADAR_ORDER.length) + 200);
  const snaps = await Promise.all(
    ESCOPO_RADAR_ORDER.map(({ key }) =>
      getDocs(
        query(collection(db, TICKETS_GLOBAL), where('escopo', '==', key), limit(perEscopoLimit))
      )
    )
  );

  const tickets = [];
  for (const snap of snaps) {
    snap.docs.forEach((d) => tickets.push(mapFirestoreTicketDoc(d)));
  }
  return tickets;
}

export async function fetchTicketsGlobalForRadar({ onProgress } = {}) {
  const tickets = [];
  let lastDoc = null;

  while (true) {
    let q = query(
      collection(db, TICKETS_GLOBAL),
      orderBy(documentId()),
      limit(PAGE_SIZE)
    );
    if (lastDoc) {
      q = query(
        collection(db, TICKETS_GLOBAL),
        orderBy(documentId()),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) break;

    snap.docs.forEach((d) => {
      tickets.push(mapFirestoreTicketDoc(d));
    });

    onProgress?.(tickets.length);
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }

  return tickets;
}

export async function fetchSquadsForRadar() {
  const snap = await getDocs(collection(db, 'squads'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.sigla || a.name || '').localeCompare(String(b.sigla || b.name || ''), 'pt-BR'));
}

export function getFilterSummary(filters) {
  const parts = [];
  if (filters.grupos?.size) parts.push(`${filters.grupos.size} grupo(s)`);
  if (filters.squads?.size) parts.push(`${filters.squads.size} squad(s)`);
  if (filters.statuses?.size) parts.push(`${filters.statuses.size} status`);
  if (!parts.length) {
    return 'Filtros independentes: selecione grupo, squad, status ou qualquer combinação.';
  }
  return `Filtro ativo: ${parts.join(', ')}. Filtros funcionam de forma independente ou combinada.`;
}

export { ESCOPO_SEED };
