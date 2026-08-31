"use strict";

const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const {
  loadJqlBatches,
  ESCOPO_SEED,
  TICKET_FIELD_DEFINITIONS,
  getJqlCargaFilePath,
} = require("./jqlCarga");

const TICKETS_GLOBAL = "tickets_global";
const SYNC_RUNS = "jira_sync_runs";
const GRUPO_ATENDIMENTO = "grupo_atendimento";
const ESCOPO_COLLECTION = "escopo";
const OPERACAO_STATS_DOC = "operacao_stats/summary";

// Com changelog (expand=changelog), cada issue retorna muito mais dados.
// Menos issues por step = respostas Jira menores + batch writes mais rápidos.
const ISSUES_PER_STEP = 20;
const MAX_WRITE_BATCH = 200;
// Limite máximo de entradas no statusHistory por ticket (evita documentos gigantes)
const MAX_STATUS_HISTORY = 150;

const ESCOPO_RADAR_ORDER = [
  { key: "PROBLEMAS", label: "PROBLEMAS", color: "#f87171" },
  { key: "DEMANDA FAST", label: "DEMANDA FAST", color: "#fb923c" },
  { key: "DEMANDA", label: "DEMANDA", color: "#facc15" },
  { key: "INCIDENTE", label: "INCIDENTE", color: "#4ade80" },
  { key: "SOLICITACAO", label: "SOLICITACAO", color: "#22d3ee" },
  { key: "CATALOGO", label: "CATALOGO", color: "#a78bfa" },
];

function normalizeEscopoKey(raw) {
  const value = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (!value) return "";
  if (value.startsWith("SOLICIT")) return "SOLICITACAO";
  if (value.startsWith("CATAL")) return "CATALOGO";
  return value;
}

function flattenByEscopoStats(raw) {
  const counts = {};
  const visit = (node, parts) => {
    if (node == null) return;
    if (typeof node === "number") {
      const key = normalizeEscopoKey(parts.join(" "));
      if (key) counts[key] = (counts[key] || 0) + node;
      return;
    }
    if (typeof node !== "object" || Array.isArray(node)) return;
    for (const [part, value] of Object.entries(node)) {
      const label = String(part).replace(/_/g, " ");
      const numeric = Number(value);
      if (Number.isFinite(numeric) && typeof value !== "object") {
        const key = normalizeEscopoKey([...parts, label].filter(Boolean).join(" "));
        if (key) counts[key] = (counts[key] || 0) + numeric;
      } else if (value && typeof value === "object") {
        visit(value, [...parts, label]);
      }
    }
  };
  visit(raw, []);
  return counts;
}

function buildRadarByEscopoFromStorageMap(byEscopo = {}, byIssueTypeByEscopo = {}) {
  const counts = flattenByEscopoStats(byEscopo);
  const issueTypesByEscopo = {};
  for (const [escopoRaw, types] of Object.entries(byIssueTypeByEscopo || {})) {
    const key = normalizeEscopoKey(String(escopoRaw).replace(/_/g, " "));
    if (!key || !types || typeof types !== "object") continue;
    issueTypesByEscopo[key] = Object.entries(types)
      .map(([name, total]) => ({ name: String(name).trim() || "Sem tipo", total: Number(total) || 0 }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
  }

  return ESCOPO_RADAR_ORDER.filter((item) => Number(counts[item.key]) > 0).map((item) => ({
    key: item.key,
    label: item.label,
    color: item.color,
    total: Number(counts[item.key]),
    issueTypes: issueTypesByEscopo[item.key] || [],
  }));
}

const STANDARD_JIRA_FIELDS = [
  "summary",
  "description",
  "environment",
  "status",
  "assignee",
  "reporter",
  "creator",
  "project",
  "issuetype",
  "priority",
  "labels",
  "components",
  "fixVersions",
  "versions",
  "parent",
  "created",
  "updated",
  "resolutiondate",
  "duedate",
  "comment",
  "attachment",
  "subtasks",
  "votes",
  "watches",
  "timespent",
  "timeestimate",
  "timeoriginalestimate",
  "resolution",
  "issuelinks",
];

let _db;

function getDb() {
  if (!_db) {
    _db = getFirestore(undefined, "default");
  }
  return _db;
}

function getJiraCredentials() {
  const token = process.env.JIRA_API_TOKEN;
  const email = process.env.JIRA_USER_EMAIL;
  const domain = process.env.JIRA_DOMAIN || "jiracpfl.atlassian.net";
  if (!token || !email) {
    throw new Error("Credenciais do Jira não configuradas no servidor.");
  }
  const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  const baseUrl = `https://${domain}`;
  return { token, email, domain, authHeader, baseUrl };
}

async function jiraFetch(path, { method = "GET", body } = {}) {
  const { authHeader, baseUrl } = getJiraCredentials();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jira retornou ${response.status}: ${errorText}`);
  }
  return response.json();
}

function normalizeJqlForCombine(jql) {
  return jql.replace(/\s+ORDER BY\s+updated\s+DESC\s*$/i, "").trim();
}

function buildCombinedOrJql(batches) {
  return batches
    .map((b) => `(${normalizeJqlForCombine(b.jql)})`)
    .join(" OR ");
}

async function getApproxCount(jql) {
  const data = await jiraFetch("/rest/api/3/search/approximate-count", {
    method: "POST",
    body: { jql },
  });
  return Number(data.count) || 0;
}

function extractFieldValue(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") return raw || null;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (Array.isArray(raw)) {
    const values = raw.map(extractFieldValue).filter(Boolean);
    return values.length ? values.join(", ") : null;
  }
  if (typeof raw === "object") {
    for (const key of ["value", "name", "displayName", "key"]) {
      if (raw[key]) return String(raw[key]);
    }
    if (Array.isArray(raw.content)) {
      const parts = [];
      for (const block of raw.content) {
        for (const item of block.content || []) {
          if (item.type === "text" && item.text) parts.push(item.text);
        }
      }
      return parts.length ? parts.join("\n") : null;
    }
  }
  return null;
}

function extractUser(fields, key) {
  const user = fields[key];
  if (!user) return { name: null, email: null, accountId: null };
  return {
    name: user.displayName || null,
    email: user.emailAddress || null,
    accountId: user.accountId || null,
  };
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "sem-nome";
}

function truncateText(text, max = 2000) {
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function computeAgingDays(createdAt) {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const now = new Date();
  const startUtc = Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate());
  const endUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((endUtc - startUtc) / 86400000));
}

function extractIssueKeyFromRef(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/[A-Z][A-Z0-9]+-\d+/);
    return match ? match[0] : null;
  }
  if (typeof value === 'object' && value.key) return value.key;
  return null;
}

function extractLinkedWorkItems(issue, fieldIds) {
  const fields = issue.fields || {};
  const linkedKey = extractIssueKeyFromRef(
    fieldIds?.parentLink ? fields[fieldIds.parentLink] : null
  );
  if (!linkedKey || linkedKey === issue.key) return [];
  return [linkedKey];
}

/**
 * Extrai os vínculos (issuelinks) do Jira com detalhes do ticket vinculado
 * (chave, tipo de issue e status), usados pelos indicadores de Observabilidade.
 * Não requer chamada extra à API — os dados já vêm expandidos na resposta de busca.
 */
function extractIssueLinksDetailed(issue) {
  const links = issue.fields?.issuelinks || [];
  const result = [];
  for (const link of links) {
    const targetIssue = link.outwardIssue || link.inwardIssue;
    if (!targetIssue) continue;
    result.push({
      key: targetIssue.key,
      issueType: (targetIssue.fields || {}).issuetype?.name || null,
      status: (targetIssue.fields || {}).status?.name || null,
      linkTypeName: (link.type || {}).name || null,
      direction: link.outwardIssue ? "outward" : "inward",
    });
  }
  return result;
}

let _fieldMapCache = null;
let _fieldIdsCache = null;

async function getFieldMap() {
  if (_fieldMapCache) return _fieldMapCache;
  const fields = await jiraFetch("/rest/api/3/field");
  _fieldMapCache = {};
  for (const field of fields) {
    if (field.name && field.id) {
      _fieldMapCache[field.name] = field.id;
    }
  }
  return _fieldMapCache;
}

function resolveFieldId(fieldMap, candidates) {
  for (const name of candidates) {
    if (fieldMap[name]) return fieldMap[name];
  }
  return null;
}

// IDs conhecidos dos campos de data de planejamento (obtidos de jira_fields.json)
// Usados como fallback caso o resolveFieldId não encontre pelo nome
const KNOWN_DATE_FIELD_IDS = {
  data_aprovacao_efsr: "customfield_10259",
  data_inicio_atendimento_planejada: "customfield_10434",
  data_inicio_atendimento: "customfield_10260",
  data_aprovacao_qa_planejada: "customfield_10435",
  data_inicio_homologacao_planejada: "customfield_10261",
  data_inicio_homologacao_efetiva: "customfield_10431",
  data_fim_homologacao_planejada: "customfield_10262",
  data_fim_homologacao_efetiva: "customfield_10432",
  data_entrega_producao_prevista: "customfield_10263",
  estimativa_horas: "customfield_10437",
  data_fim_planejado: "customfield_16711",
};

async function resolveTicketFieldIds() {
  if (_fieldIdsCache) return _fieldIdsCache;
  const fieldMap = await getFieldMap();
  const ids = {
    empresa: resolveFieldId(fieldMap, ["Empresa"]),
    fornecedor: resolveFieldId(fieldMap, ["Fornecedor"]),
    epicLink: resolveFieldId(fieldMap, ["Epic Link"]),
    parentLink: resolveFieldId(fieldMap, ["Parent Link", "Parent link"]),
  };
  for (const [col, candidates] of Object.entries(TICKET_FIELD_DEFINITIONS)) {
    // Tenta resolver pelo nome; usa ID hardcoded como fallback
    ids[col] = resolveFieldId(fieldMap, candidates) || KNOWN_DATE_FIELD_IDS[col] || null;
  }
  _fieldIdsCache = ids;
  return ids;
}

function buildJiraFieldList(fieldIds) {
  const custom = new Set(
    Object.values(fieldIds || {}).filter((id) => id && String(id).startsWith("customfield_"))
  );
  return [...STANDARD_JIRA_FIELDS, ...custom];
}

function parseJiraIssueForGlobal(issue, { escopo, syncBatch, fieldIds, baseUrl }) {
  const fields = issue.fields || {};
  const status = fields.status || {};
  const statusCategory = status.statusCategory || {};
  const project = fields.project || {};
  const issueType = fields.issuetype || {};
  const priority = fields.priority || {};
  const assignee = extractUser(fields, "assignee");
  const reporter = extractUser(fields, "reporter");
  const creator = extractUser(fields, "creator");

  const extracted = {};
  for (const col of Object.keys(TICKET_FIELD_DEFINITIONS)) {
    const fid = fieldIds[col];
    extracted[col] = fid ? extractFieldValue(fields[fid]) : null;
  }

  const empresa =
    extractFieldValue(fields[fieldIds.empresa]) || extracted.empresa || null;
  const fornecedor =
    extractFieldValue(fields[fieldIds.fornecedor]) || extracted.fornecedor || null;

  let epicKey = null;
  if (fieldIds.epicLink) {
    epicKey = extractFieldValue(fields[fieldIds.epicLink]);
  }

  const linkedWorkItems = extractLinkedWorkItems(issue, fieldIds);
  const agingDays = computeAgingDays(fields.created);
  const parentKey = (fields.parent || {}).key || null;

  const labels = Array.isArray(fields.labels) ? fields.labels : [];
  const components = (fields.components || [])
    .map((c) => c.name)
    .filter(Boolean);

  return {
    jiraId: String(issue.id || ""),
    issueKey: issue.key,
    issueUrl: `${baseUrl}/browse/${issue.key}`,
    summary: fields.summary || "",
    description: truncateText(extractFieldValue(fields.description)),
    environment: truncateText(extractFieldValue(fields.environment), 500),
    status: status.name || null,
    statusCategory: statusCategory.name || null,
    statusCategoryKey: statusCategory.key || null,
    resolution: (fields.resolution || {}).name || null,
    assignee: assignee.name,
    assigneeEmail: assignee.email,
    reporter: reporter.name,
    reporterEmail: reporter.email,
    creator: creator.name,
    projectKey: project.key || null,
    projectName: project.name || null,
    issueType: issueType.name || null,
    priority: priority.name || null,
    escopo: escopo || null,
    syncBatch: syncBatch || null,
    empresa,
    fornecedor,
    grupoSuporte: extracted.grupo_suporte || null,
    grupoSolucionador: extracted.grupo_solucionador || null,
    fornecedorTi: extracted.fornecedor_ti || null,
    demandaFast: extracted.demanda_fast || null,
    torreAtuacao: extracted.torre_atuacao || null,
    fornecedoresDropdown: extracted.fornecedores_dropdown || null,
    reopenCount: Number(extracted.quantidade_reaberturas) || 0,
    dataAprovacaoEfsr: extracted.data_aprovacao_efsr || null,
    dataInicioAtendimentoPlanejada: extracted.data_inicio_atendimento_planejada || null,
    dataInicioAtendimento: extracted.data_inicio_atendimento || null,
    dataAprovacaoQaPlanejada: extracted.data_aprovacao_qa_planejada || null,
    dataInicioHomologacaoPlanejada: extracted.data_inicio_homologacao_planejada || null,
    dataInicioHomologacaoEfetiva: extracted.data_inicio_homologacao_efetiva || null,
    dataFimHomologacaoPlanejada: extracted.data_fim_homologacao_planejada || null,
    dataFimHomologacaoEfetiva: extracted.data_fim_homologacao_efetiva || null,
    dataEntregaProducaoPrevista: extracted.data_entrega_producao_prevista || null,
    estimativaHoras: extracted.estimativa_horas != null ? Number(extracted.estimativa_horas) : null,
    dataFimPlanejado: extracted.data_fim_planejado || null,
    issueLinksDetailed: extractIssueLinksDetailed(issue),
    labels,
    components,
    parentKey,
    epicKey,
    linkedWorkItems,
    linkedTicketKeys: linkedWorkItems,
    agingDays,
    createdAt: fields.created || null,
    updatedAt: fields.updated || null,
    resolvedAt: fields.resolutiondate || null,
    dueDate: fields.duedate || null,
    commentCount: (fields.comment || {}).total || 0,
    attachmentCount: (fields.attachment || []).length,
    subtaskCount: (fields.subtasks || []).length,
    statusHistory: extractStatusHistory(issue),
  };
}

async function seedEscopos() {
  const db = getDb();
  const batch = db.batch();
  for (const item of ESCOPO_SEED) {
    const ref = db.collection(ESCOPO_COLLECTION).doc(item.id);
    batch.set(
      ref,
      {
        nome: item.nome,
        ordem: item.ordem,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();
}

async function upsertGruposFromTickets(tickets) {
  const db = getDb();
  const names = new Set();
  for (const ticket of tickets) {
    if (ticket.grupoSuporte) names.add(ticket.grupoSuporte.trim());
    if (ticket.grupoSolucionador) names.add(ticket.grupoSolucionador.trim());
  }
  if (!names.size) return;

  const batch = db.batch();
  let count = 0;
  for (const nome of names) {
    if (!nome) continue;
    const ref = db.collection(GRUPO_ATENDIMENTO).doc(slugify(nome));
    batch.set(
      ref,
      {
        nome,
        origem: "jira_sync",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    count += 1;
    if (count >= MAX_WRITE_BATCH) break;
  }
  if (count > 0) await batch.commit();
}

async function incrementStatsCounters(tickets) {
  if (!tickets.length) return;
  const db = getDb();
  const updates = {
    totalTickets: FieldValue.increment(tickets.length),
    lastIncrementalAt: FieldValue.serverTimestamp(),
  };

  const byEscopo = {};
  const byStatus = {};
  const byProject = {};
  const byIssueTypeByEscopo = {};

  for (const ticket of tickets) {
    if (ticket.escopo) {
      byEscopo[ticket.escopo] = (byEscopo[ticket.escopo] || 0) + 1;
      const escopoKey = normalizeEscopoKey(ticket.escopo);
      const issueType = String(ticket.issueType || "Sem tipo").trim() || "Sem tipo";
      if (escopoKey) {
        if (!byIssueTypeByEscopo[escopoKey]) byIssueTypeByEscopo[escopoKey] = {};
        byIssueTypeByEscopo[escopoKey][issueType] =
          (byIssueTypeByEscopo[escopoKey][issueType] || 0) + 1;
      }
    }
    if (ticket.status) byStatus[ticket.status] = (byStatus[ticket.status] || 0) + 1;
    if (ticket.projectKey) byProject[ticket.projectKey] = (byProject[ticket.projectKey] || 0) + 1;
  }

  for (const [key, value] of Object.entries(byEscopo)) {
    updates[`byEscopo.${key}`] = FieldValue.increment(value);
  }
  for (const [key, value] of Object.entries(byStatus)) {
    updates[`byStatus.${key}`] = FieldValue.increment(value);
  }
  for (const [key, value] of Object.entries(byProject)) {
    updates[`byProject.${key}`] = FieldValue.increment(value);
  }

  const issueTypePatch = { byIssueTypeByEscopo: {} };
  for (const [escopoKey, types] of Object.entries(byIssueTypeByEscopo)) {
    issueTypePatch.byIssueTypeByEscopo[escopoKey] = {};
    for (const [issueType, count] of Object.entries(types)) {
      issueTypePatch.byIssueTypeByEscopo[escopoKey][issueType] = FieldValue.increment(count);
    }
  }

  await db.doc(OPERACAO_STATS_DOC).set(updates, { merge: true });
  if (Object.keys(byIssueTypeByEscopo).length) {
    await db.doc(OPERACAO_STATS_DOC).set(issueTypePatch, { merge: true });
  }
}

async function finalizeOperacaoStats(runRef, run) {
  const db = getDb();
  const [totalSnap, statsSnap] = await Promise.all([
    db.collection(TICKETS_GLOBAL).count().get(),
    db.doc(OPERACAO_STATS_DOC).get(),
  ]);
  const stats = statsSnap.data() || {};
  const radarByEscopo = buildRadarByEscopoFromStorageMap(
    stats.byEscopo || {},
    stats.byIssueTypeByEscopo || {}
  );

  await db.doc(OPERACAO_STATS_DOC).set(
    {
      totalTicketsExact: totalSnap.data().count,
      radarByEscopo,
      syncInProgress: false,
      lastSyncAt: FieldValue.serverTimestamp(),
      lastRunId: runRef.id,
      lastSyncTicketsFetched: run.ticketsFetched || 0,
      lastSyncTicketsUpserted: run.ticketsUpserted || 0,
      lastSyncTotalEstimated: run.totalEstimated || 0,
      firestoreMitigation: {
        strategy: "lean_docs_no_raw_fields",
        chunkedSync: true,
        statsPreAggregated: true,
        batchWrites: true,
        notes:
          "~31k documentos enxutos (~1-3 KB) cabem no Firestore; leituras do painel usam operacao_stats/summary.",
      },
    },
    { merge: true }
  );
}

async function previewCarga() {
  const batches = loadJqlBatches();
  const combinedJql = buildCombinedOrJql(batches);
  const uniqueTotal = await getApproxCount(combinedJql);

  const batchResults = [];
  for (const batch of batches) {
    const total = await getApproxCount(batch.jql);
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

  // Amostra de changelog: busca 10 tickets do primeiro lote para validar coleta de change status
  let changelogSample = { sampleSize: 0, statusChangesFound: 0, avgPerTicket: 0 };
  try {
    const fieldIds = await resolveTicketFieldIds();
    const firstBatch = batches[0];
    if (firstBatch) {
      const samplePage = await searchIssuesPageGet(firstBatch.jql, { startAt: 0, fieldIds, maxResults: 10 });
      const sampleIssues = samplePage.issues || [];
      const sampleChanges = sampleIssues.reduce((acc, issue) => acc + extractStatusHistory(issue).length, 0);
      changelogSample = {
        sampleSize: sampleIssues.length,
        statusChangesFound: sampleChanges,
        avgPerTicket: sampleIssues.length > 0 ? Math.round(sampleChanges / sampleIssues.length * 10) / 10 : 0,
      };
    }
  } catch (e) {
    changelogSample = { sampleSize: 0, statusChangesFound: 0, avgPerTicket: 0, error: e.message };
  }

  return {
    total: uniqueTotal,
    totalRaw,
    approximate: true,
    jqlFile: getJqlCargaFilePath(),
    batches: batchResults,
    changelogSample,
    mitigation: {
      estimatedDocs: uniqueTotal,
      firestoreLimitDocs: 1000000,
      recommendedDocSizeKb: "1-3",
      syncStrategy: "GET_with_changelog_expand",
      dashboardReads: "operacao_stats/summary (1 doc)",
    },
  };
}

async function getJqlConfig() {
  const batches = loadJqlBatches();
  return {
    jqlFile: getJqlCargaFilePath(),
    batches: batches.map((b) => ({
      label: b.label,
      escopo: b.escopo,
      escopoId: b.escopoId,
      jql: b.jql,
    })),
    escopos: ESCOPO_SEED,
  };
}

async function createSyncRun({ startedBy, totalEstimated }) {
  const batches = loadJqlBatches();
  await seedEscopos();

  const db = getDb();
  const runRef = db.collection(SYNC_RUNS).doc();
  const now = FieldValue.serverTimestamp();

  await db.doc(OPERACAO_STATS_DOC).set(
    {
      syncInProgress: true,
      lastRunStartedAt: now,
    },
    { merge: true }
  );

  await runRef.set({
    status: "running",
    phase: "sync_batches",
    startedBy: startedBy || null,
    startedAt: now,
    updatedAt: now,
    batchIndex: 0,
    totalBatches: batches.length,
    currentBatch: batches[0]?.label || null,
    currentEscopo: batches[0]?.escopo || null,
    pageToken: null,
    ticketsFetched: 0,
    ticketsUpserted: 0,
    totalEstimated: totalEstimated || 0,
    batches: batches.map((b) => ({
      label: b.label,
      escopo: b.escopo,
      escopoId: b.escopoId,
      jql: b.jql,
      fetched: 0,
      upserted: 0,
      done: false,
    })),
    percent: 0,
    message: "Carga iniciada.",
  });

  return { runId: runRef.id };
}

/**
 * Extrai o histórico de transições de status a partir do changelog do issue.
 * Retorna array ordenado cronologicamente:
 * [{ date, fromStatus, toStatus, authorName, authorEmail, authorAccountId }]
 */
function extractStatusHistory(issue) {
  const histories = issue.changelog?.histories || [];
  const result = [];
  for (const history of histories) {
    for (const item of history.items || []) {
      if (item.field === "status") {
        result.push({
          date: history.created || null,
          fromStatus: item.fromString || null,
          toStatus: item.toString || null,
          authorName: history.author?.displayName || null,
          authorEmail: history.author?.emailAddress || null,
          authorAccountId: history.author?.accountId || null,
        });
      }
    }
  }
  result.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  // Mantém apenas as MAX_STATUS_HISTORY entradas mais recentes se houver muitas
  if (result.length > MAX_STATUS_HISTORY) {
    return result.slice(result.length - MAX_STATUS_HISTORY);
  }
  return result;
}

/**
 * Busca uma página de issues usando GET /rest/api/3/search com expand=changelog.
 * Usa startAt para paginação (a API GET não suporta nextPageToken).
 */
async function searchIssuesPageGet(jql, { startAt = 0, fieldIds, maxResults = ISSUES_PER_STEP }) {
  const fields = buildJiraFieldList(fieldIds).join(",");
  const params = new URLSearchParams({
    jql,
    maxResults: String(maxResults),
    startAt: String(startAt),
    expand: "changelog",
    fields,
  });
  return jiraFetch(`/rest/api/3/search?${params.toString()}`, { method: "GET" });
}

/** Versão sem changelog — usada na prévia de contagem (mais rápida) */
async function searchIssuesPage(jql, { pageToken, fieldIds, maxResults = ISSUES_PER_STEP }) {
  const body = {
    jql,
    maxResults,
    fields: buildJiraFieldList(fieldIds),
  };
  if (pageToken) body.nextPageToken = pageToken;

  return jiraFetch("/rest/api/3/search/jql", {
    method: "POST",
    body,
  });
}

async function searchOperacaoIssues({
  jql,
  nextPageToken,
  escopo,
  syncBatch,
  maxResults = ISSUES_PER_STEP,
}) {
  const fieldIds = await resolveTicketFieldIds();
  const { baseUrl } = getJiraCredentials();
  const page = await searchIssuesPage(jql, {
    pageToken: nextPageToken || undefined,
    fieldIds,
    maxResults,
  });
  const issues = (page.issues || []).map((issue) =>
    parseJiraIssueForGlobal(issue, {
      escopo,
      syncBatch: syncBatch || escopo,
      fieldIds,
      baseUrl,
    })
  );
  return {
    issues,
    nextPageToken: page.nextPageToken || null,
  };
}

// Campos gerenciados internamente pelo SGT — NUNCA devem ser sobrescritos pelo sync do Jira.
// São preenchidos manualmente pela equipe via updateTicketRadarFields().
const SGT_MANAGED_FIELDS = [
  "responsavelAtual",
  "dataPrevisao",
  "observacaoAdicional",
  "estimativaMacro",
  "prioridadeInterna",
  "impedimento",
  "radarFieldsUpdatedAt",
];

async function writeTicketsGlobal(tickets) {
  if (!tickets.length) return;
  const db = getDb();
  let batch = db.batch();
  let ops = 0;

  for (const ticket of tickets) {
    const ref = db.collection(TICKETS_GLOBAL).doc(ticket.issueKey);

    // Remove explicitamente os campos SGT do payload do sync para garantir
    // que nunca sejam zerados, mesmo que acidentalmente cheguem até aqui.
    const payload = { ...ticket, syncedAt: FieldValue.serverTimestamp() };
    for (const field of SGT_MANAGED_FIELDS) {
      delete payload[field];
    }

    batch.set(ref, payload, { merge: true });
    ops += 1;
    if (ops >= MAX_WRITE_BATCH) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
}

function computePercent(run) {
  if (!run.totalEstimated) {
    const doneBatches = (run.batches || []).filter((b) => b.done).length;
    return Math.min(99, Math.round((doneBatches / (run.totalBatches || 1)) * 100));
  }
  const fetched = run.ticketsFetched || 0;
  return Math.min(99, Math.round((fetched / run.totalEstimated) * 100));
}

async function processSyncStep(runId) {
  const db = getDb();
  const runRef = db.collection(SYNC_RUNS).doc(runId);
  const runSnap = await runRef.get();
  if (!runSnap.exists) {
    throw new Error("Execução de sync não encontrada.");
  }

  const run = runSnap.data();
  if (run.status === "success") {
    return { done: true, run: serializeRun(runSnap.id, run) };
  }
  if (run.status === "error") {
    return { done: true, run: serializeRun(runSnap.id, run) };
  }

  const batches = run.batches || [];
  let batchIndex = run.batchIndex || 0;
  if (batchIndex >= batches.length) {
    await finalizeSyncRun(runRef, run);
    const finalSnap = await runRef.get();
    return { done: true, run: serializeRun(runSnap.id, finalSnap.data()) };
  }

  const fieldIds = await resolveTicketFieldIds();
  const { baseUrl } = getJiraCredentials();
  const currentBatch = batches[batchIndex];

  // Usa GET com expand=changelog para capturar o histórico de status
  const currentStartAt = run.pageStartAt || 0;
  const page = await searchIssuesPageGet(currentBatch.jql, {
    startAt: currentStartAt,
    fieldIds,
  });

  const issues = page.issues || [];
  const parsed = issues.map((issue) =>
    parseJiraIssueForGlobal(issue, {
      escopo: currentBatch.escopo,
      syncBatch: currentBatch.label,
      fieldIds,
      baseUrl,
    })
  );

  await writeTicketsGlobal(parsed);
  await upsertGruposFromTickets(parsed);
  await incrementStatsCounters(parsed);

  const ticketsFetched = (run.ticketsFetched || 0) + issues.length;
  const ticketsUpserted = (run.ticketsUpserted || 0) + parsed.length;
  currentBatch.fetched = (currentBatch.fetched || 0) + issues.length;
  currentBatch.upserted = (currentBatch.upserted || 0) + parsed.length;

  // Contagem acumulada de change status
  const statusChangesInBatch = parsed.reduce((acc, t) => acc + (t.statusHistory?.length || 0), 0);
  const totalStatusChanges = (run.totalStatusChanges || 0) + statusChangesInBatch;

  // Paginação via startAt para o GET
  const nextStartAt = currentStartAt + issues.length;
  const hasMorePages = issues.length === ISSUES_PER_STEP && nextStartAt < (page.total || Infinity);
  let nextBatchIndex = batchIndex;
  let message = `Processando ${currentBatch.label}: ${currentBatch.upserted} tickets (${totalStatusChanges} change status).`;

  if (!hasMorePages) {
    currentBatch.done = true;
    nextBatchIndex += 1;
    if (nextBatchIndex < batches.length) {
      message = `Lote ${currentBatch.label} concluído. Iniciando ${batches[nextBatchIndex].label}...`;
    } else {
      message = "Finalizando agregados...";
    }
  }

  const nextBatch = batches[nextBatchIndex];
  const partialRun = {
    ...run,
    batchIndex: nextBatchIndex,
    pageStartAt: hasMorePages ? nextStartAt : 0,
    totalStatusChanges,
    ticketsFetched,
    ticketsUpserted,
    currentBatch: nextBatch ? nextBatch.label : null,
    currentEscopo: nextBatch ? nextBatch.escopo : null,
    batches,
    message,
    percent: computePercent({
      ...run,
      ticketsFetched,
      batches: batches.map((b, i) =>
        i < nextBatchIndex ? { ...b, done: true } : b
      ),
    }),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (nextBatchIndex >= batches.length) {
    await runRef.update({
      ...partialRun,
      status: "finalizing",
      message: `Finalizando agregados... ${totalStatusChanges} change status coletados.`,
    });
    await finalizeSyncRun(runRef, partialRun);
    const finalSnap = await runRef.get();
    return { done: true, run: serializeRun(runSnap.id, finalSnap.data()) };
  }

  await runRef.update(partialRun);
  const updatedSnap = await runRef.get();
  return { done: false, run: serializeRun(runSnap.id, updatedSnap.data()) };
}

async function finalizeSyncRun(runRef, run) {
  await finalizeOperacaoStats(runRef, run);
  await runRef.update({
    status: "success",
    phase: "done",
    percent: 100,
    finishedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    message: `Carga concluída: ${run.ticketsUpserted || 0} tickets sincronizados.`,
  });
}

function serializeRun(id, run) {
  return {
    runId: id,
    status: run.status,
    phase: run.phase,
    percent: run.percent || 0,
    message: run.message || "",
    batchIndex: run.batchIndex || 0,
    totalBatches: run.totalBatches || 0,
    currentBatch: run.currentBatch || null,
    currentEscopo: run.currentEscopo || null,
    ticketsFetched: run.ticketsFetched || 0,
    ticketsUpserted: run.ticketsUpserted || 0,
    totalStatusChanges: run.totalStatusChanges || 0,
    totalEstimated: run.totalEstimated || 0,
    batches: run.batches || [],
    startedAt: run.startedAt || null,
    updatedAt: run.updatedAt || null,
    finishedAt: run.finishedAt || null,
    error: run.error || null,
  };
}

async function getSyncStatus(runId) {
  const db = getDb();
  const snap = await db.collection(SYNC_RUNS).doc(runId).get();
  if (!snap.exists) {
    throw new Error("Execução de sync não encontrada.");
  }
  return serializeRun(snap.id, snap.data());
}

async function getOperacaoStats() {
  const db = getDb();
  const [statsSnap, escopoSnap, gruposSnap] = await Promise.all([
    db.doc(OPERACAO_STATS_DOC).get(),
    db.collection(ESCOPO_COLLECTION).orderBy("ordem").get(),
    db.collection(GRUPO_ATENDIMENTO).limit(500).get(),
  ]);

  return {
    stats: statsSnap.exists ? statsSnap.data() : null,
    escopos: escopoSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    gruposCount: gruposSnap.size,
    collections: {
      ticketsGlobal: TICKETS_GLOBAL,
      syncRuns: SYNC_RUNS,
      statsDoc: OPERACAO_STATS_DOC,
    },
  };
}

module.exports = {
  previewCarga,
  getJqlConfig,
  createSyncRun,
  processSyncStep,
  getSyncStatus,
  getOperacaoStats,
  seedEscopos,
  getApproxCount,
  searchOperacaoIssues,
};
