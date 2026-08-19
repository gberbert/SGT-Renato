import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  writeBatch,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ESCOPO_SEED } from '../utils/jqlCargaClient';
import {
  buildRadarByEscopoFromStorageMap,
  escopoStatsStorageKey,
  normalizeEscopoKey,
} from './operacaoRadarService';

const TICKETS_GLOBAL = 'tickets_global';
const GRUPO_ATENDIMENTO = 'grupo_atendimento';
const ESCOPO_COLLECTION = 'escopo';
const STATS_DOC = doc(db, 'operacao_stats', 'summary');

const MAX_BATCH = 450;

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'sem-nome';
}

export async function seedEscoposFirestore() {
  const batch = writeBatch(db);
  for (const item of ESCOPO_SEED) {
    batch.set(
      doc(db, ESCOPO_COLLECTION, item.id),
      {
        nome: item.nome,
        ordem: item.ordem,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();
}

export async function resetOperacaoStats() {
  const batch = writeBatch(db);
  batch.set(
    STATS_DOC,
    {
      syncInProgress: true,
      lastRunStartedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
}

export async function writeTicketsGlobalBatch(tickets) {
  if (!tickets?.length) return;
  let batch = writeBatch(db);
  let ops = 0;

  for (const ticket of tickets) {
    if (!ticket.issueKey) continue;
    batch.set(
      doc(db, TICKETS_GLOBAL, ticket.issueKey),
      { ...ticket, syncedAt: serverTimestamp() },
      { merge: true }
    );
    ops += 1;
    if (ops >= MAX_BATCH) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

export async function upsertGruposFromTickets(tickets) {
  const names = new Set();
  for (const ticket of tickets) {
    if (ticket.grupoSuporte) names.add(ticket.grupoSuporte.trim());
    if (ticket.grupoSolucionador) names.add(ticket.grupoSolucionador.trim());
  }
  if (!names.size) return;

  let batch = writeBatch(db);
  let ops = 0;
  for (const nome of names) {
    if (!nome) continue;
    batch.set(
      doc(db, GRUPO_ATENDIMENTO, slugify(nome)),
      { nome, origem: 'jira_sync', updatedAt: serverTimestamp() },
      { merge: true }
    );
    ops += 1;
    if (ops >= MAX_BATCH) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

export function createOperacaoStatsAccumulator() {
  return { total: 0, byEscopo: {}, byStatus: {}, byProject: {}, byIssueTypeByEscopo: {} };
}

export function accumulateOperacaoStats(acc, tickets) {
  if (!acc || !tickets?.length) return acc;

  for (const ticket of tickets) {
    acc.total += 1;
    if (ticket.escopo) {
      const storageKey = escopoStatsStorageKey(ticket.escopo);
      if (storageKey) acc.byEscopo[storageKey] = (acc.byEscopo[storageKey] || 0) + 1;

      const escopoKey = normalizeEscopoKey(ticket.escopo);
      const issueType = String(ticket.issueType || 'Sem tipo').trim() || 'Sem tipo';
      if (escopoKey) {
        if (!acc.byIssueTypeByEscopo[escopoKey]) acc.byIssueTypeByEscopo[escopoKey] = {};
        acc.byIssueTypeByEscopo[escopoKey][issueType] =
          (acc.byIssueTypeByEscopo[escopoKey][issueType] || 0) + 1;
      }
    }
    if (ticket.status) acc.byStatus[ticket.status] = (acc.byStatus[ticket.status] || 0) + 1;
    if (ticket.projectKey) acc.byProject[ticket.projectKey] = (acc.byProject[ticket.projectKey] || 0) + 1;
  }

  return acc;
}

export async function writeOperacaoStatsAggregate(acc) {
  if (!acc) return;

  const radarByEscopo = buildRadarByEscopoFromStorageMap(acc.byEscopo, acc.byIssueTypeByEscopo);

  const batch = writeBatch(db);
  batch.set(
    STATS_DOC,
    {
      totalTickets: acc.total,
      byEscopo: acc.byEscopo,
      byStatus: acc.byStatus,
      byProject: acc.byProject,
      byIssueTypeByEscopo: acc.byIssueTypeByEscopo,
      radarByEscopo,
      lastIncrementalAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
}

export async function incrementOperacaoStats(tickets) {
  if (!tickets?.length) return;

  const byEscopo = {};
  const byStatus = {};
  const byProject = {};

  for (const ticket of tickets) {
    if (ticket.escopo) {
      const storageKey = escopoStatsStorageKey(ticket.escopo);
      if (storageKey) byEscopo[storageKey] = (byEscopo[storageKey] || 0) + 1;
    }
    if (ticket.status) byStatus[ticket.status] = (byStatus[ticket.status] || 0) + 1;
    if (ticket.projectKey) byProject[ticket.projectKey] = (byProject[ticket.projectKey] || 0) + 1;
  }

  const updates = {
    totalTickets: increment(tickets.length),
    lastIncrementalAt: serverTimestamp(),
  };
  for (const [key, value] of Object.entries(byEscopo)) {
    updates[`byEscopo.${key}`] = increment(value);
  }
  for (const [key, value] of Object.entries(byStatus)) {
    updates[`byStatus.${key}`] = increment(value);
  }
  for (const [key, value] of Object.entries(byProject)) {
    updates[`byProject.${key}`] = increment(value);
  }

  const batch = writeBatch(db);
  batch.set(STATS_DOC, updates, { merge: true });
  await batch.commit();
}

export async function finalizeOperacaoStats(ticketsUpserted, radarByEscopo = null) {
  const batch = writeBatch(db);
  batch.set(
    STATS_DOC,
    {
      totalTicketsExact: ticketsUpserted,
      syncInProgress: false,
      lastSyncAt: serverTimestamp(),
      lastSyncTicketsUpserted: ticketsUpserted,
      ...(Array.isArray(radarByEscopo) && radarByEscopo.length ? { radarByEscopo } : {}),
    },
    { merge: true }
  );
  await batch.commit();
}

export async function fetchOperacaoStatsLocal() {
  const [statsSnap, escopoSnap, gruposSnap] = await Promise.all([
    getDoc(STATS_DOC),
    getDocs(query(collection(db, ESCOPO_COLLECTION), orderBy('ordem'))),
    getDocs(query(collection(db, GRUPO_ATENDIMENTO), limit(500))),
  ]);

  const escoposFirestore = escopoSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return {
    stats: statsSnap.exists() ? statsSnap.data() : null,
    escopos: escoposFirestore.length ? escoposFirestore : ESCOPO_SEED,
    gruposCount: gruposSnap.size,
  };
}
