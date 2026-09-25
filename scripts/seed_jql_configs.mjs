#!/usr/bin/env node

/**
 * Script para semear a collection `jql_configs` no Firebase com os JQLs padrão.
 * 
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json node scripts/seed_jql_configs.mjs
 * 
 * Ou usando Firebase emulator:
 *   firebase emulators:start
 *   export FIREBASE_EMULATOR_HOST=localhost:8080
 *   node scripts/seed_jql_configs.mjs
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Importar JQLS_DEFAULT de jqlCarga.js (Node.js comum, não módulo)
const jqlCargaPath = resolve(__dirname, '../functions/jqlCarga.js');
const jqlCargaContent = readFileSync(jqlCargaPath, 'utf-8');

// Extrair JQLS_DEFAULT usando regex simples
const jqlsMatch = jqlCargaContent.match(/const JQLS_DEFAULT = \[([\s\S]*?)\];/);
if (!jqlsMatch) {
  console.error('❌ Não foi possível extrair JQLS_DEFAULT de jqlCarga.js');
  process.exit(1);
}

// Parse usando eval (seguro aqui pois é um arquivo local do projeto)
let JQLS_DEFAULT;
try {
  eval(`JQLS_DEFAULT = [${jqlsMatch[1]}];`);
} catch (e) {
  console.error('❌ Erro ao parsear JQLS_DEFAULT:', e.message);
  process.exit(1);
}

if (!Array.isArray(JQLS_DEFAULT) || JQLS_DEFAULT.length === 0) {
  console.error('❌ JQLS_DEFAULT não é um array válido ou está vazio');
  process.exit(1);
}

console.log(`✓ Encontrado ${JQLS_DEFAULT.length} JQLs padrão`);

// Inicializar Firebase Admin SDK
if (process.env.FIREBASE_EMULATOR_HOST) {
  console.log(`🔥 Usando Firebase Emulator: ${process.env.FIREBASE_EMULATOR_HOST}`);
}

try {
  admin.initializeApp();
} catch (e) {
  // Admin SDK já inicializado
}

const db = admin.firestore();
const JQL_CONFIGS_COLLECTION = 'jql_configs';

async function seedJqlConfigs() {
  console.log(`\n📝 Semeando collection "${JQL_CONFIGS_COLLECTION}"...`);

  const batch = db.batch();
  let count = 0;

  for (const item of JQLS_DEFAULT) {
    const { escopoId, escopo, label, jql } = item;

    if (!escopoId || !jql) {
      console.warn(`⚠️  Pulando item inválido: ${JSON.stringify(item)}`);
      continue;
    }

    const ref = db.collection(JQL_CONFIGS_COLLECTION).doc(escopoId);
    batch.set(
      ref,
      {
        escopoId,
        escopo,
        label,
        jql,
        jqlOriginal: jql, // Guardar cópia original para referência
        ativo: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'seed-script',
        description: 'JQL semeada automaticamente durante setup inicial',
      },
      { merge: true }
    );

    count += 1;
    console.log(`  [${count}] ${label} (${escopo})`);
  }

  if (count === 0) {
    console.warn('⚠️  Nenhum JQL válido para semear');
    return;
  }

  try {
    await batch.commit();
    console.log(`\n✅ ${count} JQL(s) semeada(s) com sucesso em "${JQL_CONFIGS_COLLECTION}"`);
  } catch (error) {
    console.error(`❌ Erro ao committar batch: ${error.message}`);
    process.exit(1);
  }
}

// Executar
seedJqlConfigs()
  .then(() => {
    console.log('\n✅ Seed finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro durante seed:', error);
    process.exit(1);
  });
