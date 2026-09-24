/**
 * Reset jql_overrides/demanda no Firestore
 * Deleta o documento para forçar re-seed com a JQL corrigida do arquivo.
 *
 * Uso: node scripts/reset_jql_override_demanda.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SA_PATH = path.resolve(__dirname, '../Arquivos_Gerais/sgt-renato-firebase-adminsdk-fbsvc-2c3d1c9c2c.json');

async function getDb() {
  if (!fs.existsSync(SA_PATH)) {
    throw new Error(`Service account não encontrado: ${SA_PATH}`);
  }
  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  const app = initializeApp({ credential: cert(sa), projectId: sa.project_id });

  for (const databaseId of ['(default)', 'default']) {
    const db = getFirestore(app, databaseId);
    try {
      await db.collection('jql_overrides').limit(1).get();
      console.log(`✔ Conectado ao Firestore databaseId="${databaseId}"`);
      return db;
    } catch (e) {
      console.log(`  ✗ databaseId="${databaseId}" falhou: ${e.message.split('\n')[0]}`);
    }
  }
  throw new Error('Não foi possível conectar ao Firestore.');
}

async function run() {
  const db = await getDb();

  // Lista todos os documentos em jql_overrides
  const allSnap = await db.collection('jql_overrides').get();
  console.log(`\nDocumentos em jql_overrides (${allSnap.size} total):`);
  allSnap.docs.forEach(d => {
    const data = d.data();
    console.log(`  - ${d.id} | escopo=${data.escopo} | ativo=${data.ativo} | jql(50)=${String(data.jql || '').slice(0, 50)}`);
  });

  // Tenta deletar o documento 'demanda'
  const ref = db.collection('jql_overrides').doc('demanda');
  const snap = await ref.get();

  if (!snap.exists) {
    console.log('\n⚠️  Documento jql_overrides/demanda NÃO existe no Firestore.');
    console.log('   A JQL do arquivo já está sendo usada para DEMANDA.');
  } else {
    const jql = snap.data().jql || '';
    console.log(`\nJQL atual do override (${jql.length} chars):\n${jql.slice(0, 300)}${jql.length > 300 ? '...' : ''}`);
    await ref.delete();
    console.log('\n✅ Documento jql_overrides/demanda deletado com sucesso.');
    console.log('   Na próxima execução de carga, a JQL será lida do arquivo jqls_carga.txt.');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
