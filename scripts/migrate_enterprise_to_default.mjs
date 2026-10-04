/**
 * migrate_enterprise_to_default.mjs
 *
 * Migra TODOS os documentos do banco Enterprise (named: "default")
 * para o banco Padrão (named: "(default)").
 *
 * Uso: node scripts/migrate_enterprise_to_default.mjs
 */

import { initializeApp, cert, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = path.resolve(__dirname, "../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json");
const serviceAccount = JSON.parse(readFileSync(SA_PATH, "utf8"));

// Inicializa dois apps — um para cada banco
const appSrc = initializeApp(
  { credential: cert(serviceAccount), projectId: "sgt-renato" },
  "src"
);
const appDst = initializeApp(
  { credential: cert(serviceAccount), projectId: "sgt-renato" },
  "dst"
);

// Fonte: banco Enterprise nomeado "default" (sem parênteses)
const srcDb = getFirestore(appSrc, "default");
// Destino: banco Padrão "(default)" (o padrão, sem parâmetro de nome)
const dstDb = getFirestore(appDst);

let totalDocs = 0;
let totalCollections = 0;
const BATCH_SIZE = 400; // máximo seguro (limite é 500 ops/batch)

async function copyCollection(srcRef, dstRef, depth = 0) {
  const indent = "  ".repeat(depth);
  const snap = await srcRef.get();

  if (snap.empty) {
    console.log(`${indent}📂 ${srcRef.path || "(root)"} — vazia, pulando.`);
    return;
  }

  console.log(`${indent}📂 ${srcRef.path || "(root)"} — ${snap.size} docs`);
  totalCollections++;

  let batch = dstDb.batch();
  let opsInBatch = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const dstDocRef = dstRef.doc(docSnap.id);

    batch.set(dstDocRef, data, { merge: true });
    opsInBatch++;
    totalDocs++;

    if (opsInBatch >= BATCH_SIZE) {
      await batch.commit();
      batch = dstDb.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  // Recursivamente copiar subcoleções
  for (const docSnap of snap.docs) {
    const srcDocRef = srcRef.doc(docSnap.id);
    const dstDocRef = dstRef.doc(docSnap.id);
    const subCollections = await srcDocRef.listCollections();

    for (const subCol of subCollections) {
      await copyCollection(
        srcDocRef.collection(subCol.id),
        dstDocRef.collection(subCol.id),
        depth + 1
      );
    }
  }
}

async function migrate() {
  console.log("=".repeat(70));
  console.log("🚀 MIGRAÇÃO: Enterprise 'default' → Padrão '(default)'");
  console.log("=".repeat(70));
  console.log(`   Fonte: banco Enterprise (named: "default")`);
  console.log(`   Destino: banco Padrão (named: "(default)")`);
  console.log("=".repeat(70));
  console.log();

  const rootCollections = await srcDb.listCollections();

  if (rootCollections.length === 0) {
    console.log("⚠️  Nenhuma coleção encontrada no banco fonte! Verifique.");
    process.exit(1);
  }

  console.log(`📋 Coleções encontradas na fonte (${rootCollections.length}):`);
  rootCollections.forEach((col) => console.log(`   - ${col.id}`));
  console.log();

  for (const colRef of rootCollections) {
    await copyCollection(
      srcDb.collection(colRef.id),
      dstDb.collection(colRef.id),
      0
    );
    console.log();
  }

  console.log("=".repeat(70));
  console.log(`✅ MIGRAÇÃO CONCLUÍDA!`);
  console.log(`   Coleções migradas : ${totalCollections}`);
  console.log(`   Documentos migrados: ${totalDocs}`);
  console.log("=".repeat(70));
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ ERRO FATAL:", e);
    process.exit(1);
  });
