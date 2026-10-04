/**
 * migrate_holydays_squadroles_to_enterprise.mjs
 *
 * Copia as coleções "holydays" e "squadRoles" do banco Padrão "(default)"
 * para o banco Enterprise "default".
 *
 * Uso: node scripts/migrate_holydays_squadroles_to_enterprise.mjs
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = path.resolve(__dirname, "../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json");
const serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));

const COLLECTIONS_TO_MIGRATE = ["holydays", "squadroles"];
const BATCH_SIZE = 400;

// Fonte: banco Padrão "(default)"
const appSrc = initializeApp(
  { credential: cert(serviceAccount), projectId: "sgt-renato" },
  "src_padrao"
);
// Destino: banco Enterprise "default" (sem parênteses)
const appDst = initializeApp(
  { credential: cert(serviceAccount), projectId: "sgt-renato" },
  "dst_enterprise"
);

const srcDb = getFirestore(appSrc);           // (default) Padrão
const dstDb = getFirestore(appDst, "default"); // default Enterprise

let totalDocs = 0;

async function copyCollection(srcRef, dstRef, depth = 0) {
  const indent = "  ".repeat(depth);
  const snap = await srcRef.get();

  if (snap.empty) {
    console.log(`${indent}📂 ${srcRef.path} — vazia, pulando.`);
    return;
  }

  console.log(`${indent}📂 ${srcRef.path} — ${snap.size} docs`);

  let batch = dstDb.batch();
  let ops = 0;

  for (const docSnap of snap.docs) {
    const dstDocRef = dstRef.doc(docSnap.id);
    batch.set(dstDocRef, docSnap.data(), { merge: true });
    ops++;
    totalDocs++;

    if (ops >= BATCH_SIZE) {
      await batch.commit();
      batch = dstDb.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  // Subcoleções
  for (const docSnap of snap.docs) {
    const subCols = await srcRef.doc(docSnap.id).listCollections();
    for (const subCol of subCols) {
      await copyCollection(
        srcRef.doc(docSnap.id).collection(subCol.id),
        dstRef.doc(docSnap.id).collection(subCol.id),
        depth + 1
      );
    }
  }
}

async function run() {
  console.log("=".repeat(70));
  console.log("🚀  holydays + squadRoles: Padrão (default) → Enterprise default");
  console.log("=".repeat(70));
  console.log();

  for (const colName of COLLECTIONS_TO_MIGRATE) {
    console.log(`\n▶  Iniciando coleção: ${colName}`);
    await copyCollection(
      srcDb.collection(colName),
      dstDb.collection(colName)
    );
    console.log(`✅  ${colName} concluída.`);
  }

  console.log();
  console.log("=".repeat(70));
  console.log(`✅  MIGRAÇÃO CONCLUÍDA — ${totalDocs} documentos copiados.`);
  console.log("=".repeat(70));
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ ERRO:", e);
    process.exit(1);
  });
