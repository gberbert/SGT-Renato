/**
 * Dispara uma carga Jira parcial para um ou mais escopos específicos.
 *
 * Uso:
 *   node scripts/carga_por_escopo.mjs                        # lista escopos disponíveis
 *   node scripts/carga_por_escopo.mjs DEMANDA                # carrega escopo DEMANDA
 *   node scripts/carga_por_escopo.mjs DEMANDA INCIDENTE      # carrega múltiplos escopos
 *   node scripts/carga_por_escopo.mjs --all                  # carrega todos os escopos
 *
 * Requer: functions/.env com FIREBASE_SA_PATH, JIRA_API_TOKEN, JIRA_USER_EMAIL
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../functions/.env") });

// --- Injeta variáveis de ambiente como process.env para os módulos CJS ---
// (jiraGlobalSync.js usa process.env.JIRA_API_TOKEN etc.)
for (const key of ["JIRA_API_TOKEN", "JIRA_USER_EMAIL", "JIRA_DOMAIN"]) {
  if (!process.env[key]) {
    console.warn(`⚠️  Variável ${key} não definida em functions/.env`);
  }
}

// --- Localiza o service account ---
function findServiceAccount() {
  const envPath = process.env.FIREBASE_SA_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;
  const dir = path.resolve(__dirname, "../Arquivos_Gerais");
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f.includes("firebase-adminsdk"));
    if (files.length) return path.join(dir, files[0]);
  }
  return null;
}

const saPath = findServiceAccount();
if (!saPath) {
  console.error("Service account não encontrado. Defina FIREBASE_SA_PATH ou coloque o JSON em Arquivos_Gerais/");
  process.exit(1);
}

// --- Inicializa Firebase Admin antes de carregar jiraGlobalSync ---
import { initializeApp, cert } from "firebase-admin/app";

const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
initializeApp({ credential: cert(sa) });

// --- Carrega módulos CJS ---
const require = createRequire(import.meta.url);
const {
  getJqlConfig,
  createSyncRun,
  processSyncStep,
  getSyncStatus,
  getApproxCount,
} = require("../functions/jiraGlobalSync");

const POLL_INTERVAL_MS = 2000; // 2 s entre cada step

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function listEscopos() {
  const config = await getJqlConfig();
  console.log("\n📋 Escopos disponíveis:\n");
  config.batches.forEach((b) => {
    console.log(`  escopoId=${b.escopoId}   escopo=${b.escopo}   label=${b.label}`);
    console.log(`    JQL: ${b.jql.slice(0, 100)}${b.jql.length > 100 ? "…" : ""}\n`);
  });
}

async function runCarga(escopoIds) {
  const config = await getJqlConfig();
  const allBatches = config.batches;

  const selected = escopoIds.length
    ? allBatches.filter(
        (b) =>
          escopoIds.some(
            (id) =>
              b.escopoId.toUpperCase() === id.toUpperCase() ||
              b.escopo?.toUpperCase() === id.toUpperCase()
          )
      )
    : allBatches;

  if (!selected.length) {
    console.error(`\n❌ Nenhum escopo encontrado para: ${escopoIds.join(", ")}`);
    console.error("   Use sem argumentos para listar escopos disponíveis.\n");
    process.exit(1);
  }

  console.log(`\n🎯 Escopos selecionados: ${selected.map((b) => b.escopoId).join(", ")}\n`);

  // Estima total de tickets
  let totalEstimated = 0;
  for (const b of selected) {
    try {
      const count = await getApproxCount(b.jql);
      console.log(`  📊 ${b.label}: ~${count} tickets`);
      totalEstimated += count;
    } catch {
      console.warn(`  ⚠️  Não foi possível estimar ${b.label}`);
    }
  }
  console.log(`\n  Total estimado: ~${totalEstimated} tickets\n`);

  // Cria a run filtrando pelos escopos selecionados
  const { runId } = await createSyncRun({
    startedBy: "carga_por_escopo_script",
    totalEstimated,
    escopoIds: selected.map((b) => b.escopoId),
  });

  console.log(`🚀 Run criada: ${runId}\n`);

  // Processa steps até concluir
  let done = false;
  let lastMessage = "";
  let steps = 0;

  while (!done) {
    await sleep(POLL_INTERVAL_MS);
    try {
      const result = await processSyncStep(runId);
      done = result.done;
      const run = result.run;

      const msg = `[${run.percent}%] ${run.message}`;
      if (msg !== lastMessage) {
        console.log(msg);
        lastMessage = msg;
      }
      steps += 1;

      if (done || run.status === "success" || run.status === "error") {
        done = true;
        const final = await getSyncStatus(runId);
        console.log(`\n${"─".repeat(60)}`);
        console.log(`✅ Carga finalizada!`);
        console.log(`   Status     : ${final.status}`);
        console.log(`   Tickets    : ${final.ticketsUpserted} sincronizados`);
        console.log(`   Change log : ${final.totalStatusChanges || 0} transições de status`);
        console.log(`   Steps      : ${steps}`);
        console.log(`   Run ID     : ${runId}`);
        if (final.error) console.error(`   Erro       : ${final.error}`);
        console.log(`${"─".repeat(60)}\n`);
      }
    } catch (e) {
      console.error(`\n❌ Erro no step ${steps + 1}:`, e.message);
      process.exit(1);
    }
  }
}

// --- Ponto de entrada ---
const args = process.argv.slice(2);

if (!args.length) {
  await listEscopos();
  console.log("💡 Passe um ou mais escopoIds como argumento para iniciar a carga.");
  console.log("   Exemplo: node scripts/carga_por_escopo.mjs DEMANDA");
  console.log("            node scripts/carga_por_escopo.mjs --all\n");
  process.exit(0);
}

if (args[0] === "--all") {
  await runCarga([]);
} else {
  await runCarga(args.map((a) => a.trim().toUpperCase()));
}
