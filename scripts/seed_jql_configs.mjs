/**
 * Seed / visualiza a collection jql_configs no Firestore.
 *
 * Uso:
 *   node scripts/seed_jql_configs.mjs          # lista configs atuais
 *   node scripts/seed_jql_configs.mjs --seed   # força re-seed a partir de jqls_carga.txt
 *
 * Requer: functions/.env com FIREBASE_SA_PATH (ou Arquivos_Gerais/ com o arquivo de SA)
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../functions/.env") });

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

// --- Inicializa Firebase Admin ---
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore(undefined, "default");

// --- Carrega JQLs do arquivo via jqlCarga.js ---
const require = createRequire(import.meta.url);
const { loadJqlBatches } = require("../functions/jqlCarga");

const JQL_CONFIGS = "jql_configs";
const forceSeed = process.argv.includes("--seed");

async function main() {
  const batches = loadJqlBatches();
  console.log(`\n📋 JQLs encontradas no arquivo: ${batches.length}`);

  const snap = await db.collection(JQL_CONFIGS).get();
  console.log(`📦 Documentos atuais em ${JQL_CONFIGS}: ${snap.size}\n`);

  if (!forceSeed && !snap.empty) {
    console.log("--- Configs atuais em Firestore ---");
    snap.docs.forEach((d) => {
      const data = d.data();
      console.log(`  [${d.id}]  escopo=${data.escopo || "–"}  ativo=${data.ativo !== false}  updatedBy=${data.updatedBy || "–"}`);
      console.log(`    JQL: ${(data.jql || "").slice(0, 120)}${(data.jql || "").length > 120 ? "…" : ""}`);
    });
    console.log("\n💡 Use --seed para forçar re-seed a partir do arquivo.");
    process.exit(0);
  }

  // --- Seed ---
  console.log(`🌱 Semeando ${batches.length} entradas em ${JQL_CONFIGS}...`);
  const writeBatch = db.batch();
  for (const batch of batches) {
    const ref = db.collection(JQL_CONFIGS).doc(batch.escopoId);
    writeBatch.set(
      ref,
      {
        escopoId:    batch.escopoId,
        escopo:      batch.escopo,
        label:       batch.label,
        jql:         batch.jql,
        jqlOriginal: batch.jql,
        ativo:       true,
        updatedAt:   FieldValue.serverTimestamp(),
        updatedBy:   "seed_script",
        description: `JQL semeada via scripts/seed_jql_configs.mjs`,
      },
      { merge: true }
    );
  }
  await writeBatch.commit();

  console.log(`✅ ${batches.length} entradas gravadas em ${JQL_CONFIGS}:\n`);
  batches.forEach((b) => {
    console.log(`  [${b.escopoId}]  escopo=${b.escopo}  label=${b.label}`);
    console.log(`    JQL: ${b.jql.slice(0, 120)}${b.jql.length > 120 ? "…" : ""}\n`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
