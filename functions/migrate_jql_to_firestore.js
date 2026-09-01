"use strict";
/**
 * Migração: grava as 6 JQLs do arquivo data/jqls_carga.txt
 * na collection jql_overrides do Firestore.
 *
 * Uso (dentro da pasta functions/):
 *   node migrate_jql_to_firestore.js
 */

const admin = require('firebase-admin');
const { loadJqlBatches } = require('./jqlCarga');

admin.initializeApp({ projectId: 'sgt-renato' });
const db = admin.firestore();

async function main() {
  const batches = loadJqlBatches();
  console.log(`\n📋 ${batches.length} JQL(s) encontrada(s)\n`);

  for (const batch of batches) {
    const ref = db.collection('jql_overrides').doc(batch.escopoId);
    const existing = await ref.get();

    if (existing.exists) {
      console.log(`⚠  jql_overrides/${batch.escopoId} já existe — pulando`);
      continue;
    }

    await ref.set({
      escopoId:    batch.escopoId,
      escopo:      batch.escopo,
      label:       batch.label,
      jql:         batch.jql,
      originalJql: batch.jql,
      ativo:       true,
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
      updatedBy:   'migration-script',
      description: 'JQL migrada automaticamente do arquivo jqls_carga.txt',
    });

    console.log(`✅ jql_overrides/${batch.escopoId} (${batch.escopo}) gravado`);
    console.log(`   JQL: ${batch.jql.slice(0, 120)}…\n`);
  }

  console.log('\n🎉 Migração concluída.');
  process.exit(0);
}

main().catch(err => { console.error('Erro:', err); process.exit(1); });
