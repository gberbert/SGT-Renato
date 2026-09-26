import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, db } from '../firebase';
import { getOperacaoJqlConfig } from '../utils/jqlCargaClient';
import { buildRadarByEscopoFromStorageMap } from './operacaoRadarService';
import {
  seedEscoposFirestore,
  resetOperacaoStats,
  writeTicketsGlobalBatch,
  upsertGruposFromTickets,
  createOperacaoStatsAccumulator,
  accumulateOperacaoStats,
  writeOperacaoStatsAggregate,
  finalizeOperacaoStats,
  fetchOperacaoStatsLocal,
} from './operacaoFirestoreService';

export { fetchOperacaoStatsLocal };

const searchJira = httpsCallable(functions, 'searchJiraTickets');

async function loadJqlOverrides() {
  try {
    const snap = await getDoc(doc(db, 'operacao_config', 'jql_overrides'));
    return snap.exists() ? (snap.data() || {}) : {};
  } catch {
    return {};
  }
}

async function jiraApproxCount(jql) {
  const result = await searchJira({ approximateCount: true, jql });
  return Number(result.data?.count) || 0;
}

async function jiraOperacaoPage({ jql, nextPageToken, escopo, syncBatch, maxResults = 50 }) {
  const result = await searchJira({
    operacao: true,
    jql,
    nextPageToken: nextPageToken || null,
    escopo,
    syncBatch,
    maxResults,
  });
  return result.data;
}

export async function previewJiraGlobalCarga() {
  const config = getOperacaoJqlConfig();
  const staticBatches = config.batches;
  
  // Carrega overrides de Firestore
  const overrides = await loadJqlOverrides();
  
  // Mescla overrides com batches estáticos
  const batches = staticBatches.map((b) => {
    const override = overrides[b.escopoId];
    return (override != null && override !== '')
      ? { ...b, jql: override, isOverridden: true }
      : b;
  });

  const batchResults = [];
  for (const batch of batches) {
    const total = await jiraApproxCount(batch.jql);
    batchResults.push({
      label: batch.label,
      escopo: batch.escopo,
      escopoId: batch.escopoId,
      jql: batch.jql,
      total,
      approximate: true,
    });
  }

  const totalRaw = batchResults.reduce((sum, b) => sum + b.total, 0);

  return {
    total: totalRaw,
    totalRaw,
    approximate: true,
    jqlFile: config.jqlFile,
    batches: batchResults,
    mitigation: {
      estimatedDocs: totalRaw,
      firestoreLimitDocs: 1000000,
      recommendedDocSizeKb: '1-3',
      syncStrategy: 'frontend_orchestrated_with_searchJiraTickets',
      dashboardReads: 'operacao_stats/summary (1 doc)',
    },
  };
}

function computePercent({
  ticketsUpserted,
  totalEstimated,
  batchIndex,
  totalBatches,
  batchEstimates,
  batchUpsertedInBatch,
}) {
  if (totalEstimated > 0) {
    return Math.min(99, Math.round((ticketsUpserted / totalEstimated) * 100));
  }

  if (batchEstimates?.length) {
    const grandTotal = batchEstimates.reduce((sum, b) => sum + (b.total || 0), 0) || 1;
    const completedBefore = batchEstimates
      .slice(0, batchIndex)
      .reduce((sum, b) => sum + (b.total || 0), 0);
    const done = completedBefore + batchUpsertedInBatch;
    return Math.min(99, Math.round((done / grandTotal) * 100));
  }

  if (totalBatches > 0) {
    return Math.min(99, Math.round(((batchIndex + 0.25) / totalBatches) * 100));
  }

  return 0;
}

function emitProgress(state, onProgress) {
  const payload = {
    status: 'running',
    ...state,
  };
  onProgress?.(payload);
  return payload;
}

export async function runJiraGlobalCarga({
  totalEstimated = 0,
  batchEstimates = [],
  escopoIds = [],
  onProgress,
  signal,
} = {}) {
  const config = getOperacaoJqlConfig();
  const staticBatches = config.batches;
  
  // Carrega overrides de Firestore
  const overrides = await loadJqlOverrides();
  
  // Mescla overrides com batches estáticos
  let batches = staticBatches.map((b) => {
    const override = overrides[b.escopoId];
    return (override != null && override !== '')
      ? { ...b, jql: override, isOverridden: true }
      : b;
  });

  // Filtra apenas os escopos selecionados, se houver
  if (escopoIds && escopoIds.length > 0) {
    batches = batches.filter(
      (b) => escopoIds.includes(b.escopoId) || escopoIds.includes(b.escopo)
    );
  }
  
  const estimates =
    batchEstimates.length > 0
      ? batchEstimates
      : batches.map((b) => ({ escopo: b.escopo, label: b.label, total: 0 }));

  emitProgress(
    {
      percent: 0,
      message: 'Preparando coleções no Firestore…',
      currentBatch: null,
      batchIndex: 0,
      totalBatches: batches.length,
      ticketsFetched: 0,
      ticketsUpserted: 0,
      totalEstimated,
      batchProgress: estimates.map((b) => ({
        label: b.label || b.escopo,
        escopo: b.escopo,
        total: b.total || 0,
        upserted: 0,
        status: 'pending',
      })),
    },
    onProgress
  );

  await seedEscoposFirestore();
  await resetOperacaoStats();

  let ticketsFetched = 0;
  let ticketsUpserted = 0;
  const statsAccumulator = createOperacaoStatsAccumulator();
  const batchProgress = estimates.map((b) => ({
    label: b.label || b.escopo,
    escopo: b.escopo,
    total: b.total || 0,
    upserted: 0,
    status: 'pending',
  }));

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    let pageToken = null;
    let batchUpsertedInBatch = 0;

    batchProgress[batchIndex].status = 'running';

    do {
      if (signal?.aborted) {
        throw new Error('Carga cancelada pelo usuário.');
      }

      emitProgress(
        {
          percent: computePercent({
            ticketsUpserted,
            totalEstimated,
            batchIndex,
            totalBatches: batches.length,
            batchEstimates: estimates,
            batchUpsertedInBatch,
          }),
          message: `Sincronizando ${batch.label}…`,
          currentBatch: batch.label,
          currentEscopo: batch.escopo,
          batchIndex,
          totalBatches: batches.length,
          ticketsFetched,
          ticketsUpserted,
          totalEstimated,
          batchProgress: batchProgress.map((b) => ({ ...b })),
        },
        onProgress
      );

      const page = await jiraOperacaoPage({
        jql: batch.jql,
        nextPageToken: pageToken,
        escopo: batch.escopo,
        syncBatch: batch.label,
      });

      const issues = page.issues || [];
      if (issues.length) {
        await writeTicketsGlobalBatch(issues);
        await upsertGruposFromTickets(issues);
        accumulateOperacaoStats(statsAccumulator, issues);
        ticketsFetched += issues.length;
        ticketsUpserted += issues.length;
        batchUpsertedInBatch += issues.length;
        batchProgress[batchIndex].upserted = batchUpsertedInBatch;
      }

      pageToken = page.nextPageToken || null;

      emitProgress(
        {
          percent: computePercent({
            ticketsUpserted,
            totalEstimated,
            batchIndex,
            totalBatches: batches.length,
            batchEstimates: estimates,
            batchUpsertedInBatch,
          }),
          message: pageToken
            ? `${batch.label}: ${formatProgressCount(ticketsUpserted, totalEstimated)} gravados…`
            : `${batch.label} concluído.`,
          currentBatch: batch.label,
          currentEscopo: batch.escopo,
          batchIndex,
          totalBatches: batches.length,
          ticketsFetched,
          ticketsUpserted,
          totalEstimated,
          batchProgress: batchProgress.map((b, i) => ({
            ...b,
            status: i < batchIndex ? 'done' : i === batchIndex ? 'running' : 'pending',
          })),
        },
        onProgress
      );
    } while (pageToken);

    batchProgress[batchIndex].status = 'done';
  }

  await writeOperacaoStatsAggregate(statsAccumulator);
  await finalizeOperacaoStats(
    ticketsUpserted,
    buildRadarByEscopoFromStorageMap(statsAccumulator.byEscopo, statsAccumulator.byIssueTypeByEscopo)
  );

  const finalRun = {
    status: 'success',
    percent: 100,
    message: `Carga concluída: ${ticketsUpserted.toLocaleString('pt-BR')} tickets em tickets_global.`,
    ticketsFetched,
    ticketsUpserted,
    totalEstimated,
    batchIndex: batches.length,
    totalBatches: batches.length,
    currentBatch: null,
    batchProgress: batchProgress.map((b) => ({ ...b, status: 'done' })),
  };

  onProgress?.(finalRun);
  return finalRun;
}

function formatProgressCount(done, total) {
  if (total > 0) {
    return `${done.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')}`;
  }
  return done.toLocaleString('pt-BR');
}
